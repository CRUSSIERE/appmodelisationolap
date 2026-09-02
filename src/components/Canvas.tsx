import { useMemo, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import { DIM_HEIGHT, DIM_WIDTH, PARAM_RADIUS, layoutDimension } from '../layout'
import type { Action } from '../state'
import type { Dimension, Schema } from '../types'

const HIERARCHY_COLORS = ['#2563eb', '#b45309', '#0d9488', '#be185d', '#4d7c0f']
/** pointer must move this many px before a pointerdown counts as a drag, not a click */
const DRAG_THRESHOLD = 3

interface PopoverState {
  dimId: string
  paramId: string
  x: number
  y: number
}

interface EditorState {
  x: number
  y: number
  value: string
  onSubmit: (value: string) => void
}

/** offsets are in the coordinate space the dragged element is positioned in:
 * global for 'dim'/'fact', local to the dimension for the rest */
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

export function Canvas({
  schema,
  dispatch,
  svgRef,
}: {
  schema: Schema
  dispatch: Dispatch<Action>
  svgRef: React.RefObject<SVGSVGElement | null>
}) {
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
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

  function onBackgroundClick(e: React.MouseEvent) {
    const { x, y } = toLocalPoint(e.clientX, e.clientY)
    dispatch({ type: 'ADD_DIMENSION', x: x - DIM_WIDTH / 2, y: y - DIM_HEIGHT / 2 })
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
        dispatch({ type: 'MOVE_DIMENSION', dimId: drag.dimId, x: x - drag.offsetX, y: y - drag.offsetY })
        break
      case 'fact':
        dispatch({ type: 'MOVE_FACT', x: x - drag.offsetX, y: y - drag.offsetY })
        break
      case 'param': {
        const dim = schema.dimensions.find((d) => d.id === drag.dimId)
        if (!dim) return
        dispatch({
          type: 'MOVE_PARAMETER',
          dimId: drag.dimId,
          paramId: drag.paramId,
          x: x - dim.position.x - drag.offsetX,
          y: y - dim.position.y - drag.offsetY,
        })
        break
      }
      case 'weakAttr': {
        const dim = schema.dimensions.find((d) => d.id === drag.dimId)
        if (!dim) return
        dispatch({
          type: 'MOVE_WEAK_ATTRIBUTE',
          dimId: drag.dimId,
          paramId: drag.paramId,
          weakAttrId: drag.weakAttrId,
          x: x - dim.position.x - drag.offsetX,
          y: y - dim.position.y - drag.offsetY,
        })
        break
      }
      case 'chip': {
        const dim = schema.dimensions.find((d) => d.id === drag.dimId)
        if (!dim) return
        dispatch({
          type: 'MOVE_HIERARCHY_CHIP',
          dimId: drag.dimId,
          hierarchyId: drag.hierarchyId,
          x: x - dim.position.x - drag.offsetX,
          y: y - dim.position.y - drag.offsetY,
        })
        break
      }
    }
  }

  function endDrag() {
    dragRef.current = null
    dragStartRef.current = null
  }

  function startRename(
    e: React.MouseEvent,
    current: string,
    onSubmit: (value: string) => void,
  ) {
    e.stopPropagation()
    setEditor({ x: e.clientX, y: e.clientY, value: current, onSubmit })
  }

  function openPopover(dim: Dimension, paramId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (movedRef.current) {
      movedRef.current = false
      return
    }
    const svg = svgRef.current
    const l = layouts.get(dim.id)!
    const p = l.paramPos[paramId]
    const rect = svg?.getBoundingClientRect()
    setPopover({
      dimId: dim.id,
      paramId,
      x: (rect?.left ?? 0) + dim.position.x + p.x,
      y: (rect?.top ?? 0) + dim.position.y + p.y,
    })
  }

  return (
    <div className="relative h-full w-full overflow-auto bg-slate-50">
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
            stroke="#0f172a"
            rx={2}
            onPointerDown={startFactDrag}
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
            onDoubleClick={(e) =>
              startRename(e, schema.fact.name, (name) =>
                dispatch({ type: 'RENAME_FACT', name }),
              )
            }
            className="cursor-move select-none"
          >
            {schema.fact.name}
          </text>
          {schema.fact.measures.map((m, i) => (
            <g key={m.id}>
              <text
                x={factX + 12}
                y={factY + 42 + i * 20}
                fill="#e2e8f0"
                fontSize={12}
                onDoubleClick={(e) =>
                  startRename(e, m.name, (name) =>
                    dispatch({
                      type: 'RENAME_MEASURE',
                      measureId: m.id,
                      name,
                    }),
                  )
                }
              >
                {m.name}
              </text>
              <text
                x={factX + factWidth - 14}
                y={factY + 42 + i * 20}
                fill="#f87171"
                fontSize={12}
                textAnchor="end"
                className="cursor-pointer"
                onClick={() =>
                  dispatch({ type: 'DELETE_MEASURE', measureId: m.id })
                }
              >
                ×
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
            onClick={() => dispatch({ type: 'ADD_MEASURE' })}
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
              onDragStart={(e) => startDrag(dim, e)}
              onParamDragStart={(paramId, e) => startParamDrag(dim, paramId, e)}
              onWeakAttrDragStart={(paramId, waId, e) =>
                startWeakAttrDrag(dim, paramId, waId, e)
              }
              onChipDragStart={(hId, e) => startChipDrag(dim, hId, e)}
              onParamClick={(paramId, e) => openPopover(dim, paramId, e)}
              onRename={startRename}
              dispatch={dispatch}
            />
          )
        })}
      </svg>

      {popover && (
        <ParamPopover
          schema={schema}
          state={popover}
          onClose={() => setPopover(null)}
          dispatch={dispatch}
        />
      )}

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
  onDragStart,
  onParamDragStart,
  onWeakAttrDragStart,
  onChipDragStart,
  onParamClick,
  onRename,
  dispatch,
}: {
  dim: Dimension
  layout: ReturnType<typeof layoutDimension>
  onDragStart: (e: React.PointerEvent) => void
  onParamDragStart: (paramId: string, e: React.PointerEvent) => void
  onWeakAttrDragStart: (
    paramId: string,
    weakAttrId: string,
    e: React.PointerEvent,
  ) => void
  onChipDragStart: (hierarchyId: string, e: React.PointerEvent) => void
  onParamClick: (paramId: string, e: React.MouseEvent) => void
  onRename: (
    e: React.MouseEvent,
    current: string,
    onSubmit: (value: string) => void,
  ) => void
  dispatch: Dispatch<Action>
}) {
  const { x, y } = dim.position

  return (
    <g transform={`translate(${x},${y})`}>
      {/* dimension box background, drawn first so it never paints over a
          parameter's label (the key sits right on the box's right edge) */}
      <rect
        width={DIM_WIDTH}
        height={DIM_HEIGHT}
        fill="#ffffff"
        stroke="#1e293b"
        strokeWidth={1.5}
        rx={2}
        onPointerDown={onDragStart}
        className="cursor-move"
      />

      {/* DF lines between consecutive parameters of each hierarchy */}
      {dim.hierarchies.map((h) =>
        h.path.slice(0, -1).map((paramId, i) => {
          const from = layout.paramPos[paramId]
          const to = layout.paramPos[h.path[i + 1]]
          if (!from || !to) return null
          return (
            <line
              key={`${h.id}-${paramId}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#334155"
              strokeWidth={1.5}
            />
          )
        }),
      )}

      {/* hierarchy name chips */}
      {dim.hierarchies.map((h, i) => {
        const p = layout.hierarchyChipPos[h.id]
        if (!p) return null
        const color = HIERARCHY_COLORS[i % HIERARCHY_COLORS.length]
        return (
          <g key={h.id} transform={`translate(${p.x},${p.y})`}>
            <rect
              x={-28}
              y={-9}
              width={56}
              height={18}
              rx={3}
              fill={color}
              className="cursor-move"
              onPointerDown={(e) => onChipDragStart(h.id, e)}
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
            <text
              x={32}
              y={4}
              fontSize={11}
              fill="#dc2626"
              className="cursor-pointer"
              onClick={() =>
                dispatch({
                  type: 'DELETE_HIERARCHY',
                  dimId: dim.id,
                  hierarchyId: h.id,
                })
              }
            >
              ×
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
                fill="#1e293b"
                style={{ paintOrder: 'stroke', stroke: '#f8fafc', strokeWidth: 3 }}
                className="cursor-move"
                onPointerDown={(e) => onWeakAttrDragStart(p.id, wa.id, e)}
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
              >
                {wa.name}
              </text>
              <text
                x={wl.labelX + wa.name.length * 6 + 8}
                y={wl.labelY}
                fontSize={11}
                fill="#dc2626"
                className="cursor-pointer"
                onClick={() =>
                  dispatch({
                    type: 'DELETE_WEAK_ATTRIBUTE',
                    dimId: dim.id,
                    paramId: p.id,
                    weakAttrId: wa.id,
                  })
                }
              >
                ×
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
        return (
          <g key={p.id} transform={`translate(${pos.x},${pos.y})`}>
            {/* larger invisible hit-area so the now-small ring stays easy to click/drag */}
            <circle
              r={PARAM_RADIUS + 8}
              fill="transparent"
              className="cursor-pointer"
              onPointerDown={(e) => onParamDragStart(p.id, e)}
              onClick={(e) => onParamClick(p.id, e)}
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
              stroke="#1e293b"
              strokeWidth={isKey ? 2 : 1.5}
              pointerEvents="none"
            />
            <text
              y={PARAM_RADIUS + 13}
              textAnchor="middle"
              fontSize={11}
              fontWeight={isKey ? 700 : 400}
              fill="#1e293b"
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
        onDoubleClick={(e) =>
          onRename(e, dim.name, (name) =>
            dispatch({ type: 'RENAME_DIMENSION', dimId: dim.id, name }),
          )
        }
        className="cursor-move select-none"
      >
        {dim.name}
      </text>
      <text
        x={DIM_WIDTH - 4}
        y={-6}
        textAnchor="end"
        fontSize={13}
        fill="#dc2626"
        className="cursor-pointer"
        onClick={() => {
          if (window.confirm(`Supprimer la dimension ${dim.name} ?`)) {
            dispatch({ type: 'DELETE_DIMENSION', dimId: dim.id })
          }
        }}
      >
        × supprimer
      </text>
    </g>
  )
}

function ParamPopover({
  schema,
  state,
  onClose,
  dispatch,
}: {
  schema: Schema
  state: PopoverState
  onClose: () => void
  dispatch: Dispatch<Action>
}) {
  const dim = schema.dimensions.find((d) => d.id === state.dimId)
  if (!dim) return null
  const isKey = state.paramId === dim.keyParameterId
  const terminalHierarchies = dim.hierarchies.filter(
    (h) => h.path[h.path.length - 1] === state.paramId,
  )

  const items: { label: string; onClick: () => void }[] = [
    {
      label: 'Ajouter un attribut faible',
      onClick: () => {
        dispatch({
          type: 'ADD_WEAK_ATTRIBUTE',
          dimId: dim.id,
          paramId: state.paramId,
        })
        onClose()
      },
    },
  ]

  if (isKey && dim.hierarchies.length === 0) {
    items.push({
      label: 'Ajouter une hiérarchie',
      onClick: () => {
        dispatch({ type: 'ADD_HIERARCHY', dimId: dim.id })
        onClose()
      },
    })
  } else if (isKey) {
    items.push({
      label: 'Ajouter une hiérarchie alternative',
      onClick: () => {
        dispatch({ type: 'ADD_HIERARCHY', dimId: dim.id })
        onClose()
      },
    })
  }

  for (const h of terminalHierarchies) {
    items.push({
      label:
        terminalHierarchies.length > 1
          ? `Ajouter un niveau au-dessus (${h.name})`
          : 'Ajouter un niveau au-dessus',
      onClick: () => {
        dispatch({ type: 'ADD_LEVEL_ABOVE', dimId: dim.id, hierarchyId: h.id })
        onClose()
      },
    })
  }

  if (!isKey && terminalHierarchies.length > 0) {
    items.push({
      label: 'Supprimer ce niveau',
      onClick: () => {
        dispatch({
          type: 'DELETE_PARAMETER',
          dimId: dim.id,
          paramId: state.paramId,
        })
        onClose()
      },
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        className="fixed z-20 min-w-[220px] rounded border border-slate-300 bg-white py-1 shadow-lg"
        style={{ left: state.x + 20, top: state.y - 10 }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
