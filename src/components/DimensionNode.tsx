import { DIM_HEIGHT, PARAM_RADIUS, layoutDimension } from '../layout'
import { SELECTED_COLOR, dimKey, edgeKey, hierarchyKey, paramKey, weakAttrKey } from '../selection'
import { DEFAULT_TEXT_STYLE, SCALE, fontOf, measureText } from '../textStyle'
import type { SchemaDispatch } from '../state'
import type { Dimension, HierarchyLinkType, TextStyle } from '../types'

const HIERARCHY_COLORS = ['#2563eb', '#b45309', '#0d9488', '#be185d', '#4d7c0f']
/** [child-end, parent-end] cardinalities drawn on a hierarchy edge — same
 * pairs as the link-type labels in elementActions.ts. `none` leaves the edge
 * unlabelled. */
const LINK_TYPE_ENDS: Record<HierarchyLinkType, [string, string] | null> = {
  strict: ['1,n', '1,1'],
  non_strict: ['1,n', '1,n'],
  strict_incomplete: ['0,n', '0,1'],
  non_strict_incomplete: ['0,n', '0,n'],
  none: null,
}
/** distance from a parameter circle at which its cardinality label sits */
const CARD_LABEL_OFFSET = 24
/** how far above the trait the label floats — enough to clear the hierarchy
 * name-chip, which straddles the middle of an edge */
const CARD_LABEL_LIFT = 14

/** One dimension: its rectangle, its parameter tree, the weak attributes
 * hanging off it and the hierarchy name-chips. Positions come from
 * `layout`, local to the dimension, so the whole node moves with one
 * transform on the group Canvas wraps it in. */
export function DimensionNode({
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
  onEdgeContextMenu,
  onSelectClick,
  onRename,
  dispatch,
  style,
  showCardinalities,
}: {
  dim: Dimension
  layout: ReturnType<typeof layoutDimension>
  style: TextStyle
  showCardinalities: boolean
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
  onEdgeContextMenu: (from: string, to: string, e: React.MouseEvent) => void
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

  // first hierarchy carrying an explicit type for that edge wins the label;
  // absent everywhere means the GraphicOLAP default, 'strict'
  function edgeLinkType(from: string, to: string): HierarchyLinkType {
    for (const h of dim.hierarchies) {
      const type = h.linkTypes?.[`${from}->${to}`]
      if (type) return type
    }
    return 'strict'
  }

  const s = style.fontSize / DEFAULT_TEXT_STYLE.fontSize

  return (
    <g transform={`translate(${x},${y})`}>
      {/* dimension box background, drawn first so it never paints over a
          parameter's label (the key sits right on the box's right edge) */}
      <rect
        width={layout.boxWidth}
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
        // hidden either for this edge alone ('none') or diagram-wide
        const ends = showCardinalities ? LINK_TYPE_ENDS[edgeLinkType(from, to)] : null
        // unit vector along the edge + its normal, so each label sits a fixed
        // distance from its circle and just off the trait
        const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1
        const ux = (p1.x - p0.x) / len
        const uy = (p1.y - p0.y) / len
        const t = Math.min(CARD_LABEL_OFFSET, len / 2)
        const nx = uy * CARD_LABEL_LIFT
        const ny = -ux * CARD_LABEL_LIFT
        const cards: { key: string; x: number; y: number; text: string }[] = ends
          ? [
              { key: 'from', x: p0.x + ux * t + nx, y: p0.y + uy * t + ny, text: ends[0] },
              { key: 'to', x: p1.x - ux * t + nx, y: p1.y - uy * t + ny, text: ends[1] },
            ]
          : []
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
              onContextMenu={(e) => onEdgeContextMenu(from, to, e)}
            />
            {/* cardinality/completeness at each end of the roll-up. Shown for
                every link type including 'strict', so a labelled edge reads
                on its own; empty when hidden per-link or diagram-wide. */}
            {cards.map((c) => (
              <text
                key={c.key}
                x={c.x}
                y={c.y}
                fontSize={`${SCALE.cardinality}em`}
                fill="#64748b"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
                style={{ paintOrder: 'stroke', stroke: '#f8fafc', strokeWidth: 3 }}
              >
                {c.text}
              </text>
            ))}
          </g>
        )
      })}

      {/* hierarchy name chips */}
      {dim.hierarchies.map((h, i) => {
        const p = layout.hierarchyChipPos[h.id]
        if (!p) return null
        const color = HIERARCHY_COLORS[i % HIERARCHY_COLORS.length]
        const selected = selection.has(hierarchyKey(dim.id, h.id))
        // the chip grows to its name instead of clipping it
        const chipWidth = Math.max(
          56,
          Math.ceil(measureText(h.name, fontOf(style, SCALE.chip, 700))) + 12,
        )
        const chipHeight = 18 * s
        return (
          <g key={h.id} transform={`translate(${p.x},${p.y})`}>
            <rect
              x={-chipWidth / 2}
              y={-chipHeight / 2}
              width={chipWidth}
              height={chipHeight}
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
              y={4 * s}
              textAnchor="middle"
              fill="#fff"
              fontSize={`${SCALE.chip}em`}
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
                fontSize={`${SCALE.weakAttr}em`}
                textDecoration="underline"
                fill={selected ? SELECTED_COLOR : style.color}
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
              y={PARAM_RADIUS + 13 * s}
              textAnchor="middle"
              fontSize={`${SCALE.param}em`}
              fontWeight={isKey ? 700 : 400}
              fill={selected ? SELECTED_COLOR : style.color}
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
        x={layout.boxWidth / 2}
        y={DIM_HEIGHT / 2 + 5 * s}
        textAnchor="middle"
        fontWeight={700}
        fontSize={`${SCALE.dimName}em`}
        fill={style.color}
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
