import { useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  dimensionMenuItems,
  factMenuItems,
  hierarchyMenuItems,
  measureMenuItems,
  paramBaseMenuItems,
  weakAttrMenuItems,
} from '../elementActions'
import { DIM_HEIGHT, DIM_WIDTH, PARAM_RADIUS, layoutDimension } from '../layout'
import {
  FACT_KEY,
  dimKey,
  edgeKey,
  hierarchyKey,
  measureKey,
  paramKey,
  selectOnly,
  toggleInSelection,
  weakAttrKey,
} from '../selection'
import type { SchemaDispatch } from '../state'
import type { Dimension, Parameter, Schema } from '../types'
import { ContextMenu, type MenuItem, type MenuState } from './ContextMenu'

const HIERARCHY_COLORS = ['#2563eb', '#b45309', '#0d9488', '#be185d', '#4d7c0f']
const SELECTED_COLOR = '#2563eb'
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
  | { kind: 'fact'; offsetX: number; offsetY: number }
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
  const dragRef = useRef<DragState | null>(null)
  const movedRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  const layouts = useMemo(() => {
    const map = new Map<string, ReturnType<typeof layoutDimension>>()
    for (const dim of schema.dimensions) map.set(dim.id, layoutDimension(dim))
    return map
  }, [schema.dimensions])

  const bounds = useMemo(() => {
    let right = 1600
    let bottom = 900
    for (const dim of schema.dimensions) {
      const l = layouts.get(dim.id)!
      right = Math.max(right, dim.position.x + l.width + 200)
      bottom = Math.max(bottom, dim.position.y + l.height + 400)
    }
    right = Math.max(right, schema.fact.position.x + 400)
    bottom = Math.max(bottom, schema.fact.position.y + 200)
    return { width: right, height: bottom }
  }, [schema.dimensions, schema.fact.position, layouts])

  const factWidth = 170
  const factHeight = 56 + schema.fact.measures.length * 20
  const factX = schema.fact.position.x
  const factY = schema.fact.position.y

  function toLocalPoint(clientX: number, clientY: number) {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  /** every selectable key whose element intersects `rect` (global coords) */
  function collectInRect(rect: Rect): string[] {
    const keys: string[] = []
    if (rectsOverlap(rect, { x: factX, y: factY, w: factWidth, h: factHeight })) {
      keys.push(FACT_KEY)
      schema.fact.measures.forEach((m, i) => {
        const my = factY + 42 + i * 20
        if (pointInRect(factX + factWidth / 2, my, rect)) keys.push(measureKey(m.id))
      })
    }
    for (const dim of schema.dimensions) {
      const l = layouts.get(dim.id)!
      const dimRect = { x: dim.position.x, y: dim.position.y, w: DIM_WIDTH, h: DIM_HEIGHT }
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
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function startDrag(dim: Dimension, e: React.PointerEvent) {
    const { x, y } = toLocalPoint(e.clientX, e.clientY)
    beginDrag(
      { kind: 'dim', dimId: dim.id, offsetX: x - dim.position.x, offsetY: y - dim.position.y },
      e,
    )
  }

  function startFactDrag(e: React.PointerEvent) {
    const { x, y } = toLocalPoint(e.clientX, e.clientY)
    beginDrag(
      {
        kind: 'fact',
        offsetX: x - schema.fact.position.x,
        offsetY: y - schema.fact.position.y,
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
          { type: 'MOVE_FACT', x: x - drag.offsetX, y: y - drag.offsetY },
          'move-fact',
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
    const isKey = paramId === dim.keyParameterId
    const terminalHierarchies = dim.hierarchies.filter(
      (h) => h.path[h.path.length - 1] === paramId,
    )
    const items: MenuItem[] = [
      {
        label: 'Ajouter un attribut faible',
        onClick: () => dispatch({ type: 'ADD_WEAK_ATTRIBUTE', dimId: dim.id, paramId }),
      },
    ]
    if (isKey) {
      items.push({
        label:
          dim.hierarchies.length === 0
            ? 'Ajouter une hiérarchie'
            : 'Ajouter une hiérarchie alternative',
        onClick: () => dispatch({ type: 'ADD_HIERARCHY', dimId: dim.id }),
      })
    }
    for (const h of terminalHierarchies) {
      items.push({
        label:
          terminalHierarchies.length > 1
            ? `Ajouter un niveau au-dessus (${h.name})`
            : 'Ajouter un niveau au-dessus',
        onClick: () => dispatch({ type: 'ADD_LEVEL_ABOVE', dimId: dim.id, hierarchyId: h.id }),
      })
    }
    return items
  }

  function onDimContextMenu(dim: Dimension, e: React.MouseEvent) {
    openMenu(
      dimensionMenuItems(dim, dispatch, () =>
        startRename(e, dim.name, (name) =>
          dispatch({ type: 'RENAME_DIMENSION', dimId: dim.id, name }),
        ),
      ),
      e,
    )
  }

  function onFactContextMenu(e: React.MouseEvent) {
    openMenu(
      factMenuItems(schema.fact, () =>
        startRename(e, schema.fact.name, (name) => dispatch({ type: 'RENAME_FACT', name })),
      ),
      e,
    )
  }

  function onMeasureContextMenu(m: { id: string; name: string }, e: React.MouseEvent) {
    openMenu(
      measureMenuItems(m, dispatch, () =>
        startRename(e, m.name, (name) =>
          dispatch({ type: 'RENAME_MEASURE', measureId: m.id, name }),
        ),
      ),
      e,
    )
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
        viewBox={`0 0 ${bounds.width} ${bounds.height}`}
        className="block select-none"
        onPointerMove={onDrag}
        onPointerUp={endDrag}
      >
        <rect
          x={0}
          y={0}
          width={bounds.width}
          height={bounds.height}
          fill="#f8fafc"
          onPointerDown={startMarquee}
          onClick={onBackgroundClick}
        />

        {/* fact-to-dimension connections, drawn first so they sit behind everything */}
        {schema.dimensions.map((dim) => {
          const dimTargetX = dim.position.x + DIM_WIDTH / 2
          const dimTargetY = dim.position.y + DIM_HEIGHT
          const factTopX = Math.min(
            Math.max(dimTargetX, factX),
            factX + factWidth,
          )
          return (
            <line
              key={`link-${dim.id}`}
              x1={factTopX}
              y1={factY}
              x2={dimTargetX}
              y2={dimTargetY}
              stroke="#94a3b8"
              strokeWidth={1.5}
            />
          )
        })}

        {/* fact */}
        <g>
          <rect
            x={factX}
            y={factY}
            width={factWidth}
            height={factHeight}
            fill="#1e293b"
            stroke={selection.has(FACT_KEY) ? SELECTED_COLOR : '#0f172a'}
            strokeWidth={selection.has(FACT_KEY) ? 3 : 1.5}
            rx={2}
            onPointerDown={startFactDrag}
            onClick={(e) => selectClick(FACT_KEY, e)}
            onContextMenu={onFactContextMenu}
            className="cursor-move"
          />
          <text
            x={factX + factWidth / 2}
            y={factY + 22}
            textAnchor="middle"
            fill="#ffffff"
            fontWeight={700}
            fontSize={14}
            onPointerDown={startFactDrag}
            onClick={(e) => selectClick(FACT_KEY, e)}
            onDoubleClick={(e) =>
              startRename(e, schema.fact.name, (name) =>
                dispatch({ type: 'RENAME_FACT', name }),
              )
            }
            onContextMenu={onFactContextMenu}
            className="cursor-move select-none"
          >
            {schema.fact.name}
          </text>
          {schema.fact.measures.map((m, i) => (
            <g key={m.id}>
              <text
                x={factX + 12}
                y={factY + 42 + i * 20}
                fill={selection.has(measureKey(m.id)) ? '#93c5fd' : '#e2e8f0'}
                fontSize={12}
                className="cursor-pointer"
                onClick={(e) => selectClick(measureKey(m.id), e)}
                onDoubleClick={(e) =>
                  startRename(e, m.name, (name) =>
                    dispatch({
                      type: 'RENAME_MEASURE',
                      measureId: m.id,
                      name,
                    }),
                  )
                }
                onContextMenu={(e) => onMeasureContextMenu(m, e)}
              >
                {m.name}
              </text>
            </g>
          ))}
          <text
            x={factX + factWidth / 2}
            y={factY + factHeight - 6}
            textAnchor="middle"
            fill="#93c5fd"
            fontSize={12}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              dispatch({ type: 'ADD_MEASURE' })
            }}
          >
            + mesure
          </text>
        </g>

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
              onSelectClick={selectClick}
              onRename={startRename}
              dispatch={dispatch}
            />
          )
        })}

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

function DimensionNode({
  dim,
  layout,
  selection,
  onDragStart,
  onParamDragStart,
  onWeakAttrDragStart,
  onChipDragStart,
  onDimContextMenu,
  onParamContextMenu,
  onWeakAttrContextMenu,
  onHierarchyContextMenu,
  onSelectClick,
  onRename,
  dispatch,
}: {
  dim: Dimension
  layout: ReturnType<typeof layoutDimension>
  selection: Set<string>
  onDragStart: (e: React.PointerEvent) => void
  onParamDragStart: (paramId: string, e: React.PointerEvent) => void
  onWeakAttrDragStart: (
    paramId: string,
    weakAttrId: string,
    e: React.PointerEvent,
  ) => void
  onChipDragStart: (hierarchyId: string, e: React.PointerEvent) => void
  onDimContextMenu: (e: React.MouseEvent) => void
  onParamContextMenu: (paramId: string, e: React.MouseEvent) => void
  onWeakAttrContextMenu: (paramId: string, weakAttrId: string, e: React.MouseEvent) => void
  onHierarchyContextMenu: (hierarchyId: string, e: React.MouseEvent) => void
  onSelectClick: (key: string, e: React.MouseEvent) => void
  onRename: (
    e: React.MouseEvent,
    current: string,
    onSubmit: (value: string) => void,
  ) => void
  dispatch: SchemaDispatch
}) {
  const { x, y } = dim.position
  const isDimSelected = selection.has(dimKey(dim.id))

  // unique (from,to) segments across every hierarchy — a segment shared by
  // several hierarchies is drawn (and clicked) once, deleting/duplicating
  // it acts on all of them (see selection.ts)
  const edges: { from: string; to: string }[] = []
  const seenEdges = new Set<string>()
  dim.hierarchies.forEach((h) => {
    h.path.slice(0, -1).forEach((from, i) => {
      const to = h.path[i + 1]
      const key = `${from}->${to}`
      if (seenEdges.has(key)) return
      seenEdges.add(key)
      edges.push({ from, to })
    })
  })

  return (
    <g transform={`translate(${x},${y})`}>
      {/* dimension box background, drawn first so it never paints over a
          parameter's label (the key sits right on the box's right edge) */}
      <rect
        width={DIM_WIDTH}
        height={DIM_HEIGHT}
        fill="#ffffff"
        stroke={isDimSelected ? SELECTED_COLOR : '#1e293b'}
        strokeWidth={isDimSelected ? 3 : 1.5}
        rx={2}
        onPointerDown={onDragStart}
        onClick={(e) => onSelectClick(dimKey(dim.id), e)}
        onContextMenu={onDimContextMenu}
        className="cursor-move transition-[stroke] hover:stroke-blue-400"
      />

      {/* DF lines between consecutive parameters, one per unique segment */}
      {edges.map(({ from, to }) => {
        const p0 = layout.paramPos[from]
        const p1 = layout.paramPos[to]
        if (!p0 || !p1) return null
        const selected = selection.has(edgeKey(dim.id, from, to))
        return (
          <g key={`${from}-${to}`}>
            <line
              x1={p0.x}
              y1={p0.y}
              x2={p1.x}
              y2={p1.y}
              stroke={selected ? SELECTED_COLOR : '#334155'}
              strokeWidth={selected ? 3 : 1.5}
              pointerEvents="none"
            />
            {/* wider transparent line so the thin trait stays easy to click */}
            <line
              x1={p0.x}
              y1={p0.y}
              x2={p1.x}
              y2={p1.y}
              stroke="transparent"
              strokeWidth={10}
              className="cursor-pointer"
              onClick={(e) => onSelectClick(edgeKey(dim.id, from, to), e)}
            />
          </g>
        )
      })}

      {/* hierarchy name chips */}
      {dim.hierarchies.map((h, i) => {
        const p = layout.hierarchyChipPos[h.id]
        if (!p) return null
        const color = HIERARCHY_COLORS[i % HIERARCHY_COLORS.length]
        const selected = selection.has(hierarchyKey(dim.id, h.id))
        return (
          <g key={h.id} transform={`translate(${p.x},${p.y})`}>
            <rect
              x={-28}
              y={-9}
              width={56}
              height={18}
              rx={3}
              fill={color}
              stroke={selected ? '#1e3a8a' : 'none'}
              strokeWidth={selected ? 2 : 0}
              className="cursor-move"
              onPointerDown={(e) => onChipDragStart(h.id, e)}
              onClick={(e) => onSelectClick(hierarchyKey(dim.id, h.id), e)}
              onDoubleClick={(e) =>
                onRename(e, h.name, (name) =>
                  dispatch({
                    type: 'RENAME_HIERARCHY',
                    dimId: dim.id,
                    hierarchyId: h.id,
                    name,
                  }),
                )
              }
              onContextMenu={(e) => onHierarchyContextMenu(h.id, e)}
            />
            <text
              y={4}
              textAnchor="middle"
              fill="#fff"
              fontSize={9}
              fontWeight={700}
              pointerEvents="none"
            >
              {h.name}
            </text>
          </g>
        )
      })}

      {/* weak attributes */}
      {dim.parameters.map((p) =>
        p.weakAttributes.map((wa) => {
          const base = layout.paramPos[p.id]
          const wl = layout.weakAttrPos[`${p.id}:${wa.id}`]
          if (!base || !wl) return null
          const selected = selection.has(weakAttrKey(dim.id, p.id, wa.id))
          return (
            <g key={wa.id}>
              <line
                x1={base.x}
                y1={base.y}
                x2={wl.x}
                y2={wl.y}
                stroke="#64748b"
                strokeWidth={1}
              />
              <text
                x={wl.labelX}
                y={wl.labelY}
                fontSize={11}
                textDecoration="underline"
                fill={selected ? SELECTED_COLOR : '#1e293b'}
                style={{ paintOrder: 'stroke', stroke: '#f8fafc', strokeWidth: 3 }}
                className="cursor-move"
                onPointerDown={(e) => onWeakAttrDragStart(p.id, wa.id, e)}
                onClick={(e) => onSelectClick(weakAttrKey(dim.id, p.id, wa.id), e)}
                onDoubleClick={(e) =>
                  onRename(e, wa.name, (name) =>
                    dispatch({
                      type: 'RENAME_WEAK_ATTRIBUTE',
                      dimId: dim.id,
                      paramId: p.id,
                      weakAttrId: wa.id,
                      name,
                    }),
                  )
                }
                onContextMenu={(e) => onWeakAttrContextMenu(p.id, wa.id, e)}
              >
                {wa.name}
              </text>
            </g>
          )
        }),
      )}

      {/* parameter circles */}
      {dim.parameters.map((p) => {
        const pos = layout.paramPos[p.id]
        if (!pos) return null
        const isKey = p.id === dim.keyParameterId
        const selected = selection.has(paramKey(dim.id, p.id))
        return (
          <g key={p.id} transform={`translate(${pos.x},${pos.y})`}>
            {/* larger invisible hit-area so the now-small ring stays easy to click/drag */}
            <circle
              r={PARAM_RADIUS + 8}
              fill="transparent"
              className="cursor-pointer"
              onPointerDown={(e) => onParamDragStart(p.id, e)}
              onClick={(e) => onSelectClick(paramKey(dim.id, p.id), e)}
              onContextMenu={(e) => onParamContextMenu(p.id, e)}
              onDoubleClick={(e) =>
                onRename(e, p.name, (name) =>
                  dispatch({
                    type: 'RENAME_PARAMETER',
                    dimId: dim.id,
                    paramId: p.id,
                    name,
                  }),
                )
              }
            />
            <circle
              r={PARAM_RADIUS}
              fill="#ffffff"
              stroke={selected ? SELECTED_COLOR : '#1e293b'}
              strokeWidth={selected ? 3 : isKey ? 2 : 1.5}
              pointerEvents="none"
            />
            <text
              y={PARAM_RADIUS + 13}
              textAnchor="middle"
              fontSize={11}
              fontWeight={isKey ? 700 : 400}
              fill={selected ? SELECTED_COLOR : '#1e293b'}
              style={{ paintOrder: 'stroke', stroke: '#f8fafc', strokeWidth: 3 }}
              pointerEvents="none"
            >
              {p.name}
            </text>
          </g>
        )
      })}

      {/* dimension name + delete, drawn above the background rect */}
      <text
        x={DIM_WIDTH / 2}
        y={DIM_HEIGHT / 2 + 5}
        textAnchor="middle"
        fontWeight={700}
        fontSize={13}
        fill="#1e293b"
        onPointerDown={onDragStart}
        onClick={(e) => onSelectClick(dimKey(dim.id), e)}
        onDoubleClick={(e) =>
          onRename(e, dim.name, (name) =>
            dispatch({ type: 'RENAME_DIMENSION', dimId: dim.id, name }),
          )
        }
        onContextMenu={onDimContextMenu}
        className="cursor-move select-none"
      >
        {dim.name}
      </text>
    </g>
  )
}

