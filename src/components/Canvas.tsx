import { useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  dimensionMenuItems,
  factMenuItems,
  hierarchyLinkTypeMenuItems,
  hierarchyMenuItems,
  measureMenuItems,
  paramBaseMenuItems,
  paramHierarchyMenuItems,
  weakAttrMenuItems,
} from '../elementActions'
import { DIM_HEIGHT, layoutDimension } from '../layout'
import { DEFAULT_TEXT_STYLE, SCALE, fontOf, measureText } from '../textStyle'
import {
  dimKey,
  edgeKey,
  factKey,
  hierarchyKey,
  measureKey,
  paramKey,
  selectOnly,
  toggleInSelection,
  weakAttrKey,
  SELECTED_COLOR,
} from '../selection'
import type { SchemaDispatch } from '../state'
import type { Dimension, Fact, Parameter, Schema } from '../types'
import { ContextMenu, type MenuItem, type MenuState } from './ContextMenu'
import { DimensionNode } from './DimensionNode'

/** pointer must move this many px before a pointerdown counts as a drag, not a click */
const DRAG_THRESHOLD = 3

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface EditorState {
  x: number
  y: number
  value: string
  onSubmit: (value: string) => void
}

/** offsets are in the coordinate space the dragged element is positioned in:
 * global for 'dim'/'fact'/'marquee', local to the dimension for the rest */
type DragState =
  | { kind: 'dim'; dimId: string; offsetX: number; offsetY: number }
  | { kind: 'fact'; factId: string; offsetX: number; offsetY: number }
  | { kind: 'param'; dimId: string; paramId: string; offsetX: number; offsetY: number }
  | {
      kind: 'weakAttr'
      dimId: string
      paramId: string
      weakAttrId: string
      offsetX: number
      offsetY: number
    }
  | { kind: 'chip'; dimId: string; hierarchyId: string; offsetX: number; offsetY: number }
  | { kind: 'marquee'; additive: boolean; startX: number; startY: number }

function rectsOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function pointInRect(px: number, py: number, r: Rect) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

export function Canvas({
  schema,
  dispatch,
  svgRef,
  selection,
  setSelection,
  commit,
}: {
  schema: Schema
  dispatch: SchemaDispatch
  svgRef: React.RefObject<SVGSVGElement | null>
  selection: Set<string>
  setSelection: Dispatch<SetStateAction<Set<string>>>
  commit: () => void
}) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null)
  const [frozenOrigin, setFrozenOrigin] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const movedRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  const style = schema.textStyle ?? DEFAULT_TEXT_STYLE
  const showCardinalities = schema.showCardinalities ?? true
  /** every hard-coded vertical offset below was authored at the default base
   * size; scaling them keeps the boxes proportional when the size changes */
  const s = style.fontSize / DEFAULT_TEXT_STYLE.fontSize

  const layouts = useMemo(() => {
    const map = new Map<string, ReturnType<typeof layoutDimension>>()
    for (const dim of schema.dimensions) map.set(dim.id, layoutDimension(dim, style))
    return map
  }, [schema.dimensions, style])

  const FACT_MIN_WIDTH = 170
  /** the box grows to whichever of its labels is widest, so a long fact or
   * measure name never spills out of the rectangle */
  const factSize = (fact: Fact) => {
    const widest = Math.max(
      measureText(fact.name, fontOf(style, SCALE.factName, 700)),
      measureText('+ mesure', fontOf(style, SCALE.measure)),
      ...fact.measures.map((m) => measureText(m.name, fontOf(style, SCALE.measure))),
    )
    return {
      width: Math.max(FACT_MIN_WIDTH, Math.ceil(widest) + 24),
      height: (56 + fact.measures.length * 20) * s,
    }
  }

  const bounds = useMemo(() => {
    let minX = 0
    let minY = 0
    let maxX = 1600
    let maxY = 900
    for (const dim of schema.dimensions) {
      const l = layouts.get(dim.id)!
      // a dimension oriented 'left'/'up' extends behind its own anchor, so
      // the viewport has to start at a negative coordinate to show it
      minX = Math.min(minX, dim.position.x + l.minX)
      minY = Math.min(minY, dim.position.y + l.minY)
      maxX = Math.max(maxX, dim.position.x + l.minX + l.width + 200)
      maxY = Math.max(maxY, dim.position.y + l.minY + l.height + 400)
    }
    for (const fact of schema.facts) {
      maxX = Math.max(maxX, fact.position.x + 400)
      maxY = Math.max(maxY, fact.position.y + 200)
    }
    return { minX, minY, width: maxX - minX, height: maxY - minY }
  }, [schema.dimensions, schema.facts, layouts])

  /**
   * Origin of the SVG viewport. It normally follows `bounds`, but a drag
   * freezes it: dragging an element past the left/top edge would otherwise
   * push `bounds.minX` further negative mid-gesture, moving the coordinate
   * frame under the pointer and making the element jump by that much.
   */
  const origin = frozenOrigin ?? { x: bounds.minX, y: bounds.minY }

  function toLocalPoint(clientX: number, clientY: number) {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return { x: clientX - rect.left + origin.x, y: clientY - rect.top + origin.y }
  }

  /** every selectable key whose element intersects `rect` (global coords) */
  function collectInRect(rect: Rect): string[] {
    const keys: string[] = []
    for (const fact of schema.facts) {
      const { width, height } = factSize(fact)
      const { x: fx, y: fy } = fact.position
      if (rectsOverlap(rect, { x: fx, y: fy, w: width, h: height })) {
        keys.push(factKey(fact.id))
        fact.measures.forEach((m, i) => {
          const my = fy + 42 + i * 20
          if (pointInRect(fx + width / 2, my, rect)) keys.push(measureKey(fact.id, m.id))
        })
      }
    }
    for (const dim of schema.dimensions) {
      const l = layouts.get(dim.id)!
      const dimRect = { x: dim.position.x, y: dim.position.y, w: l.boxWidth, h: DIM_HEIGHT }
      if (rectsOverlap(rect, dimRect)) keys.push(dimKey(dim.id))

      for (const p of dim.parameters) {
        const pos = l.paramPos[p.id]
        if (pos && pointInRect(dim.position.x + pos.x, dim.position.y + pos.y, rect)) {
          keys.push(paramKey(dim.id, p.id))
        }
        for (const wa of p.weakAttributes) {
          const wp = l.weakAttrPos[`${p.id}:${wa.id}`]
          if (wp && pointInRect(dim.position.x + wp.x, dim.position.y + wp.y, rect)) {
            keys.push(weakAttrKey(dim.id, p.id, wa.id))
          }
        }
      }

      for (const h of dim.hierarchies) {
        const cp = l.hierarchyChipPos[h.id]
        if (cp && pointInRect(dim.position.x + cp.x, dim.position.y + cp.y, rect)) {
          keys.push(hierarchyKey(dim.id, h.id))
        }
        h.path.slice(0, -1).forEach((from, i) => {
          const to = h.path[i + 1]
          const p0 = l.paramPos[from]
          const p1 = l.paramPos[to]
          if (!p0 || !p1) return
          const mx = dim.position.x + (p0.x + p1.x) / 2
          const my = dim.position.y + (p0.y + p1.y) / 2
          if (pointInRect(mx, my, rect)) keys.push(edgeKey(dim.id, from, to))
        })
      }
    }
    return keys
  }

  /** shared select handler for every clickable element: plain click replaces
   * the selection, Shift/Ctrl toggles membership. Suppressed if the click
   * follows an actual drag (movedRef), same convention as the rest of the
   * canvas uses to tell a click from a drag-release. */
  function selectClick(key: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (movedRef.current) {
      movedRef.current = false
      return
    }
    const additive = e.shiftKey || e.ctrlKey || e.metaKey
    setSelection((prev) => (additive ? toggleInSelection(prev, key) : selectOnly(key)))
  }

  function onBackgroundClick(e: React.MouseEvent) {
    if (movedRef.current) {
      movedRef.current = false
      return
    }
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) setSelection(new Set())
  }

  function beginDrag(state: DragState, e: React.PointerEvent) {
    e.stopPropagation()
    movedRef.current = false
    dragRef.current = state
    dragStartRef.current = toLocalPoint(e.clientX, e.clientY)
    setFrozenOrigin({ x: bounds.minX, y: bounds.minY })
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function startDrag(dim: Dimension, e: React.PointerEvent) {
    const { x, y } = toLocalPoint(e.clientX, e.clientY)
    beginDrag(
      { kind: 'dim', dimId: dim.id, offsetX: x - dim.position.x, offsetY: y - dim.position.y },
      e,
    )
  }

  function startFactDrag(fact: Fact, e: React.PointerEvent) {
    const { x, y } = toLocalPoint(e.clientX, e.clientY)
    beginDrag(
      {
        kind: 'fact',
        factId: fact.id,
        offsetX: x - fact.position.x,
        offsetY: y - fact.position.y,
      },
      e,
    )
  }

  function startParamDrag(dim: Dimension, paramId: string, e: React.PointerEvent) {
    const { x, y } = toLocalPoint(e.clientX, e.clientY)
    const cur = layouts.get(dim.id)!.paramPos[paramId]
    beginDrag(
      {
        kind: 'param',
        dimId: dim.id,
        paramId,
        offsetX: x - dim.position.x - cur.x,
        offsetY: y - dim.position.y - cur.y,
      },
      e,
    )
  }

  function startWeakAttrDrag(
    dim: Dimension,
    paramId: string,
    weakAttrId: string,
    e: React.PointerEvent,
  ) {
    const { x, y } = toLocalPoint(e.clientX, e.clientY)
    const cur = layouts.get(dim.id)!.weakAttrPos[`${paramId}:${weakAttrId}`]
    beginDrag(
      {
        kind: 'weakAttr',
        dimId: dim.id,
        paramId,
        weakAttrId,
        offsetX: x - dim.position.x - cur.x,
        offsetY: y - dim.position.y - cur.y,
      },
      e,
    )
  }

  function startChipDrag(dim: Dimension, hierarchyId: string, e: React.PointerEvent) {
    const { x, y } = toLocalPoint(e.clientX, e.clientY)
    const cur = layouts.get(dim.id)!.hierarchyChipPos[hierarchyId]
    beginDrag(
      {
        kind: 'chip',
        dimId: dim.id,
        hierarchyId,
        offsetX: x - dim.position.x - cur.x,
        offsetY: y - dim.position.y - cur.y,
      },
      e,
    )
  }

  function startMarquee(e: React.PointerEvent) {
    const { x, y } = toLocalPoint(e.clientX, e.clientY)
    beginDrag(
      { kind: 'marquee', additive: e.shiftKey || e.ctrlKey || e.metaKey, startX: x, startY: y },
      e,
    )
  }

  function onDrag(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const { x, y } = toLocalPoint(e.clientX, e.clientY)

    if (!movedRef.current) {
      const start = dragStartRef.current
      const dist = start ? Math.hypot(x - start.x, y - start.y) : Infinity
      if (dist < DRAG_THRESHOLD) return
      movedRef.current = true
    }

    switch (drag.kind) {
      case 'dim':
        dispatch(
          { type: 'MOVE_DIMENSION', dimId: drag.dimId, x: x - drag.offsetX, y: y - drag.offsetY },
          `move-dim-${drag.dimId}`,
        )
        break
      case 'fact':
        dispatch(
          { type: 'MOVE_FACT', factId: drag.factId, x: x - drag.offsetX, y: y - drag.offsetY },
          `move-fact-${drag.factId}`,
        )
        break
      case 'param': {
        const dim = schema.dimensions.find((d) => d.id === drag.dimId)
        if (!dim) return
        dispatch(
          {
            type: 'MOVE_PARAMETER',
            dimId: drag.dimId,
            paramId: drag.paramId,
            x: x - dim.position.x - drag.offsetX,
            y: y - dim.position.y - drag.offsetY,
          },
          `move-param-${drag.dimId}-${drag.paramId}`,
        )
        break
      }
      case 'weakAttr': {
        const dim = schema.dimensions.find((d) => d.id === drag.dimId)
        if (!dim) return
        dispatch(
          {
            type: 'MOVE_WEAK_ATTRIBUTE',
            dimId: drag.dimId,
            paramId: drag.paramId,
            weakAttrId: drag.weakAttrId,
            x: x - dim.position.x - drag.offsetX,
            y: y - dim.position.y - drag.offsetY,
          },
          `move-wa-${drag.dimId}-${drag.paramId}-${drag.weakAttrId}`,
        )
        break
      }
      case 'chip': {
        const dim = schema.dimensions.find((d) => d.id === drag.dimId)
        if (!dim) return
        dispatch(
          {
            type: 'MOVE_HIERARCHY_CHIP',
            dimId: drag.dimId,
            hierarchyId: drag.hierarchyId,
            x: x - dim.position.x - drag.offsetX,
            y: y - dim.position.y - drag.offsetY,
          },
          `move-chip-${drag.dimId}-${drag.hierarchyId}`,
        )
        break
      }
      case 'marquee':
        setMarqueeRect({
          x: Math.min(drag.startX, x),
          y: Math.min(drag.startY, y),
          w: Math.abs(x - drag.startX),
          h: Math.abs(y - drag.startY),
        })
        break
    }
  }

  function endDrag() {
    const drag = dragRef.current
    if (drag?.kind === 'marquee' && marqueeRect) {
      const keys = collectInRect(marqueeRect)
      setSelection((prev) => {
        const base = drag.additive ? new Set(prev) : new Set<string>()
        for (const k of keys) base.add(k)
        return base
      })
    }
    setMarqueeRect(null)
    setFrozenOrigin(null)
    dragRef.current = null
    dragStartRef.current = null
    commit()
  }

  function startRename(
    e: React.MouseEvent,
    current: string,
    onSubmit: (value: string) => void,
  ) {
    e.stopPropagation()
    setEditor({ x: e.clientX, y: e.clientY, value: current, onSubmit })
  }

  function openMenu(items: MenuItem[], e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  /** items only meaningful on a hierarchy-carrying parameter, appended after
   * the generic rename/duplicate/copy/delete set (see paramBaseMenuItems) */
  function paramHierarchyItems(dim: Dimension, paramId: string): MenuItem[] {
    return [
      {
        label: 'Ajouter un attribut faible',
        onClick: () => dispatch({ type: 'ADD_WEAK_ATTRIBUTE', dimId: dim.id, paramId }),
      },
      ...paramHierarchyMenuItems(dim, paramId, dispatch),
    ]
  }

  function onDimContextMenu(dim: Dimension, e: React.MouseEvent) {
    openMenu(
      dimensionMenuItems(schema, dim, dispatch, () =>
        startRename(e, dim.name, (name) =>
          dispatch({ type: 'RENAME_DIMENSION', dimId: dim.id, name }),
        ),
      ),
      e,
    )
  }

  function onFactContextMenu(fact: Fact, e: React.MouseEvent) {
    openMenu(
      factMenuItems(fact, dispatch, () =>
        startRename(e, fact.name, (name) =>
          dispatch({ type: 'RENAME_FACT', factId: fact.id, name }),
        ),
      ),
      e,
    )
  }

  function onMeasureContextMenu(factId: string, m: { id: string; name: string }, e: React.MouseEvent) {
    openMenu(
      measureMenuItems(factId, m, dispatch, () =>
        startRename(e, m.name, (name) =>
          dispatch({ type: 'RENAME_MEASURE', factId, measureId: m.id, name }),
        ),
      ),
      e,
    )
  }

  function onEdgeContextMenu(dim: Dimension, from: string, to: string, e: React.MouseEvent) {
    const hierarchyIds = dim.hierarchies
      .filter((h) => h.path.some((p, i) => p === from && h.path[i + 1] === to))
      .map((h) => h.id)
    if (hierarchyIds.length === 0) return
    openMenu(hierarchyLinkTypeMenuItems(dim.id, hierarchyIds, from, to, dispatch), e)
  }

  function onParamContextMenu(dim: Dimension, param: Parameter, e: React.MouseEvent) {
    openMenu(
      [
        ...paramBaseMenuItems(dim, param, dispatch, () =>
          startRename(e, param.name, (name) =>
            dispatch({ type: 'RENAME_PARAMETER', dimId: dim.id, paramId: param.id, name }),
          ),
        ),
        ...paramHierarchyItems(dim, param.id),
      ],
      e,
    )
  }

  function onWeakAttrContextMenu(
    dim: Dimension,
    param: Parameter,
    waId: string,
    e: React.MouseEvent,
  ) {
    const wa = param.weakAttributes.find((w) => w.id === waId)
    if (!wa) return
    openMenu(
      weakAttrMenuItems(dim, param, wa, dispatch, () =>
        startRename(e, wa.name, (name) =>
          dispatch({
            type: 'RENAME_WEAK_ATTRIBUTE',
            dimId: dim.id,
            paramId: param.id,
            weakAttrId: wa.id,
            name,
          }),
        ),
      ),
      e,
    )
  }

  function onHierarchyContextMenu(dim: Dimension, hierarchyId: string, e: React.MouseEvent) {
    const h = dim.hierarchies.find((x) => x.id === hierarchyId)
    if (!h) return
    openMenu(
      hierarchyMenuItems(dim, h, dispatch, () =>
        startRename(e, h.name, (name) =>
          dispatch({ type: 'RENAME_HIERARCHY', dimId: dim.id, hierarchyId: h.id, name }),
        ),
      ),
      e,
    )
  }

  return (
    <div className="relative h-full w-full overflow-auto bg-slate-100">
      <svg
        ref={svgRef}
        width={bounds.width}
        height={bounds.height}
        viewBox={`${origin.x} ${origin.y} ${bounds.width} ${bounds.height}`}
        className="block select-none"
        style={{ fontFamily: style.fontFamily, fontSize: style.fontSize }}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        // a cancelled gesture must release the frozen viewport origin too,
        // or the canvas stays clipped until the next drag
        onPointerCancel={endDrag}
      >
        <rect
          data-export="background"
          x={origin.x}
          y={origin.y}
          width={bounds.width}
          height={bounds.height}
          fill="#f8fafc"
          onPointerDown={startMarquee}
          onClick={onBackgroundClick}
        />

        {/* everything the export frames: the background rect and the
            marquee sit outside, so applyCrop measures the diagram alone */}
        <g data-export="content">
          {/* fact-to-dimension connections, drawn first so they sit behind everything */}
          {schema.facts.map((fact) => {
            const { width } = factSize(fact)
            return fact.dimensionIds.map((dimId) => {
              const dim = schema.dimensions.find((d) => d.id === dimId)
              if (!dim) return null
              const dimTargetX = dim.position.x + layouts.get(dim.id)!.boxWidth / 2
              // leave the box on the side the hierarchy does not occupy, so the
              // link doesn't run straight through a downward-oriented dimension
              const dimTargetY =
                dim.orientation === 'down' ? dim.position.y : dim.position.y + DIM_HEIGHT
              const factTopX = Math.min(Math.max(dimTargetX, fact.position.x), fact.position.x + width)
              return (
                <line
                  key={`link-${fact.id}-${dimId}`}
                  x1={factTopX}
                  y1={fact.position.y}
                  x2={dimTargetX}
                  y2={dimTargetY}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                />
              )
            })
          })}

          {/* facts */}
          {schema.facts.map((fact) => {
            const { width, height } = factSize(fact)
            const { x: fx, y: fy } = fact.position
            const selected = selection.has(factKey(fact.id))
            return (
              <g key={fact.id}>
                <rect
                  x={fx}
                  y={fy}
                  width={width}
                  height={height}
                  fill="#1e293b"
                  stroke={selected ? SELECTED_COLOR : '#0f172a'}
                  strokeWidth={selected ? 3 : 1.5}
                  rx={2}
                  onPointerDown={(e) => startFactDrag(fact, e)}
                  onClick={(e) => selectClick(factKey(fact.id), e)}
                  onContextMenu={(e) => onFactContextMenu(fact, e)}
                  className="cursor-move"
                />
                <text
                  x={fx + width / 2}
                  y={fy + 22 * s}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontWeight={700}
                  fontSize={`${SCALE.factName}em`}
                  onPointerDown={(e) => startFactDrag(fact, e)}
                  onClick={(e) => selectClick(factKey(fact.id), e)}
                  onDoubleClick={(e) =>
                    startRename(e, fact.name, (name) =>
                      dispatch({ type: 'RENAME_FACT', factId: fact.id, name }),
                    )
                  }
                  onContextMenu={(e) => onFactContextMenu(fact, e)}
                  className="cursor-move select-none"
                >
                  {fact.name}
                </text>
                {fact.measures.map((m, i) => (
                  <g key={m.id}>
                    <text
                      x={fx + 12}
                      y={fy + (42 + i * 20) * s}
                      fill={selection.has(measureKey(fact.id, m.id)) ? '#93c5fd' : '#e2e8f0'}
                      fontSize={`${SCALE.measure}em`}
                      className="cursor-pointer"
                      onClick={(e) => selectClick(measureKey(fact.id, m.id), e)}
                      onDoubleClick={(e) =>
                        startRename(e, m.name, (name) =>
                          dispatch({
                            type: 'RENAME_MEASURE',
                            factId: fact.id,
                            measureId: m.id,
                            name,
                          }),
                        )
                      }
                      onContextMenu={(e) => onMeasureContextMenu(fact.id, m, e)}
                    >
                      {m.name}
                    </text>
                  </g>
                ))}
                <text
                  x={fx + width / 2}
                  y={fy + height - 6 * s}
                  textAnchor="middle"
                  fill="#93c5fd"
                  fontSize={`${SCALE.measure}em`}
                  data-export="chrome"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    dispatch({ type: 'ADD_MEASURE', factId: fact.id })
                  }}
                >
                  + mesure
                </text>
              </g>
            )
          })}

          {schema.dimensions.map((dim) => {
            const l = layouts.get(dim.id)!
            return (
              <DimensionNode
                key={dim.id}
                dim={dim}
                layout={l}
                selection={selection}
                onDragStart={(e) => startDrag(dim, e)}
                onParamDragStart={(paramId, e) => startParamDrag(dim, paramId, e)}
                onWeakAttrDragStart={(paramId, waId, e) =>
                  startWeakAttrDrag(dim, paramId, waId, e)
                }
                onChipDragStart={(hId, e) => startChipDrag(dim, hId, e)}
                onDimContextMenu={(e) => onDimContextMenu(dim, e)}
                onParamContextMenu={(paramId, e) => {
                  const param = dim.parameters.find((p) => p.id === paramId)
                  if (param) onParamContextMenu(dim, param, e)
                }}
                onWeakAttrContextMenu={(paramId, waId, e) => {
                  const param = dim.parameters.find((p) => p.id === paramId)
                  if (param) onWeakAttrContextMenu(dim, param, waId, e)
                }}
                onHierarchyContextMenu={(hId, e) => onHierarchyContextMenu(dim, hId, e)}
                onEdgeContextMenu={(from, to, e) => onEdgeContextMenu(dim, from, to, e)}
                onSelectClick={selectClick}
                onRename={startRename}
                dispatch={dispatch}
                style={style}
                showCardinalities={showCardinalities}
              />
            )
          })}
        </g>

        {marqueeRect && (
          <rect
            x={marqueeRect.x}
            y={marqueeRect.y}
            width={marqueeRect.w}
            height={marqueeRect.h}
            fill="#2563eb1a"
            stroke={SELECTED_COLOR}
            strokeWidth={1}
            pointerEvents="none"
          />
        )}
      </svg>

      {menu && <ContextMenu state={menu} onClose={() => setMenu(null)} />}

      {editor && (
        <InlineEditor state={editor} onClose={() => setEditor(null)} />
      )}
    </div>
  )
}

function InlineEditor({
  state,
  onClose,
}: {
  state: EditorState
  onClose: () => void
}) {
  const [value, setValue] = useState(state.value)

  function commit() {
    const trimmed = value.trim()
    if (trimmed.length > 0) state.onSubmit(trimmed)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={commit} />
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.keyCode === 13) commit()
          if (e.key === 'Escape' || e.keyCode === 27) onClose()
        }}
        className="fixed z-20 rounded border-2 border-blue-500 bg-white px-2 py-0.5 text-sm shadow-lg outline-none"
        style={{ left: state.x - 8, top: state.y - 12 }}
      />
    </>
  )
}
