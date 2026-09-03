import { DEFAULT_TEXT_STYLE, SCALE, fontOf, measureText } from './textStyle'
import type { Dimension, Hierarchy, Orientation, TextStyle } from './types'

/** the dimension rectangle never shrinks below this; it grows to fit its name */
export const DIM_MIN_WIDTH = 140
export const DIM_HEIGHT = 48
export const PARAM_RADIUS = 6
const COL_WIDTH = 100
const ROW_HEIGHT = 64
const WEAK_ATTR_STEP = 34
/** horizontal breathing room around the dimension name inside its rectangle */
const DIM_NAME_PADDING = 24
/** slack around the outermost node, so labels drawn beside or under a node
 * (parameter names, weak attributes) stay inside the reported bounding box */
const LABEL_PAD = WEAK_ATTR_STEP * 2

/** width the dimension rectangle needs to hold its name at the current style */
export function dimBoxWidth(dim: Dimension, style: TextStyle = DEFAULT_TEXT_STYLE): number {
  const w = measureText(dim.name, fontOf(style, SCALE.dimName, 700))
  return Math.max(DIM_MIN_WIDTH, Math.ceil(w) + DIM_NAME_PADDING)
}

export interface Point {
  x: number
  y: number
}

export interface WeakAttrLayout extends Point {
  labelX: number
  labelY: number
}

/**
 * Picks the path edge a hierarchy's name-chip sits on: its first segment
 * that no other hierarchy of the dimension also uses. Hierarchies sharing a
 * trunk (e.g. both starting at the key) then land their chip on the segment
 * where they actually branch off, instead of piling up on the shared trunk.
 */
function pickChipEdge(dim: Dimension, h: Hierarchy): [string, string] | null {
  if (h.path.length < 2) return null
  const otherEdges = new Set<string>()
  for (const other of dim.hierarchies) {
    if (other.id === h.id) continue
    for (let i = 0; i < other.path.length - 1; i++) {
      otherEdges.add(`${other.path[i]}->${other.path[i + 1]}`)
    }
  }
  for (let i = 0; i < h.path.length - 1; i++) {
    if (!otherEdges.has(`${h.path[i]}->${h.path[i + 1]}`)) {
      return [h.path[i], h.path[i + 1]]
    }
  }
  // every segment is also used by another hierarchy (e.g. identical paths) — default to the first
  return [h.path[0], h.path[1]]
}

/** projects `pt` onto segment [p0, p1], clamped to stay between the two endpoints */
function clampToSegment(pt: Point, p0: Point, p1: Point): Point {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return { x: p0.x, y: p0.y }
  const t = Math.max(0, Math.min(1, ((pt.x - p0.x) * dx + (pt.y - p0.y) * dy) / lenSq))
  return { x: p0.x + t * dx, y: p0.y + t * dy }
}

export interface DimensionLayout {
  /** paramId -> position, local to the dimension's anchor (position.x/y = rect top-left) */
  paramPos: Record<string, Point>
  /** `${paramId}:${weakAttrId}` -> line end + label position, local coords */
  weakAttrPos: Record<string, WeakAttrLayout>
  /** hierarchyId -> chip center position, local coords */
  hierarchyChipPos: Record<string, Point>
  /** width of the dimension rectangle itself, grown to fit its name */
  boxWidth: number
  /** local bounding box, used to size the SVG viewport. minX/minY are 0 for
   * the default 'right' orientation but go negative for 'left'/'up', where
   * the hierarchy fans out on the other side of the rectangle's anchor. */
  minX: number
  minY: number
  width: number
  height: number
}

/** maps a node's (depth, row) in the hierarchy tree to local coordinates.
 * depth counts roll-up levels away from the key, row separates alternative
 * hierarchies; which screen axis each one uses is what `orientation` picks. */
function placeNode(
  depth: number,
  row: number,
  orientation: Orientation,
  boxWidth: number,
): Point {
  switch (orientation) {
    case 'left':
      return { x: -depth * COL_WIDTH, y: DIM_HEIGHT / 2 + row * ROW_HEIGHT }
    case 'up':
      return { x: boxWidth / 2 + row * COL_WIDTH, y: -depth * ROW_HEIGHT }
    case 'down':
      return { x: boxWidth / 2 + row * COL_WIDTH, y: DIM_HEIGHT + depth * ROW_HEIGHT }
    case 'right':
    default:
      return { x: boxWidth + depth * COL_WIDTH, y: DIM_HEIGHT / 2 + row * ROW_HEIGHT }
  }
}

/**
 * Lays out a dimension's parameter tree: the key sits on the edge of the
 * dimension rectangle (depth 0) and each hierarchy fans out from there in
 * the dimension's `orientation`. Nodes shared by
 * every hierarchy of the dimension (the trunk) land on the center row;
 * nodes only reachable through a subset of hierarchies get pulled toward
 * that subset's average row, which is what makes alternative hierarchies
 * visually bifurcate.
 */
export function layoutDimension(
  dim: Dimension,
  style: TextStyle = DEFAULT_TEXT_STYLE,
): DimensionLayout {
  const boxWidth = dimBoxWidth(dim, style)
  const orientation = dim.orientation ?? 'right'
  const n = dim.hierarchies.length
  const targetRow = (hIndex: number) => hIndex - (n - 1) / 2

  const paramDepth = new Map<string, number>()
  const paramRows = new Map<string, number[]>()

  // the key always gets a position, even before any hierarchy is defined —
  // it's what the dimension rectangle and the fact-link line anchor to
  paramDepth.set(dim.keyParameterId, 0)
  paramRows.set(dim.keyParameterId, [0])

  dim.hierarchies.forEach((h, hIndex) => {
    h.path.forEach((paramId, depth) => {
      if (!paramDepth.has(paramId)) paramDepth.set(paramId, depth)
      const rows = paramRows.get(paramId) ?? []
      rows.push(targetRow(hIndex))
      paramRows.set(paramId, rows)
    })
  })

  // a parameter can exist without being on any hierarchy path yet (e.g. just
  // duplicated) — stack those below the laid-out rows instead of leaving
  // them with no position, which would make them invisible on canvas
  const laidOutRows = [...paramRows.values()].flat()
  const orphanBaseRow = Math.max(0, ...laidOutRows) + 1
  let orphanOffset = 0
  for (const p of dim.parameters) {
    if (paramDepth.has(p.id)) continue
    paramDepth.set(p.id, 0)
    paramRows.set(p.id, [orphanBaseRow + orphanOffset])
    orphanOffset += 1
  }

  const paramPos: Record<string, Point> = {}
  const paramById = new Map(dim.parameters.map((p) => [p.id, p]))
  for (const [paramId, depth] of paramDepth) {
    const override = paramById.get(paramId)?.position
    if (override) {
      paramPos[paramId] = override
      continue
    }
    const rows = paramRows.get(paramId) ?? [0]
    const avgRow = rows.reduce((a, b) => a + b, 0) / rows.length
    paramPos[paramId] = placeNode(depth, avgRow, orientation, boxWidth)
  }

  const weakAttrPos: Record<string, WeakAttrLayout> = {}
  for (const param of dim.parameters) {
    const base = paramPos[param.id]
    if (!base) continue
    param.weakAttributes.forEach((wa, i) => {
      if (wa.position) {
        weakAttrPos[`${param.id}:${wa.id}`] = {
          x: wa.position.x,
          y: wa.position.y,
          labelX: wa.position.x + 6,
          labelY: wa.position.y - 4,
        }
        return
      }
      const dx = WEAK_ATTR_STEP + i * 8
      const dy = -(WEAK_ATTR_STEP + i * WEAK_ATTR_STEP * 0.6)
      weakAttrPos[`${param.id}:${wa.id}`] = {
        x: base.x + dx,
        y: base.y + dy,
        labelX: base.x + dx + 6,
        labelY: base.y + dy - 4,
      }
    })
  }

  const hierarchyChipPos: Record<string, Point> = {}
  dim.hierarchies.forEach((h) => {
    const edge = pickChipEdge(dim, h)
    if (!edge) return
    const p0 = paramPos[edge[0]]
    const p1 = paramPos[edge[1]]
    if (!p0 || !p1) return
    hierarchyChipPos[h.id] = h.chipPosition
      ? clampToSegment(h.chipPosition, p0, p1)
      : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
  })

  // measured from the placed nodes rather than from (depth, row): it stays
  // correct for every orientation, and absorbs manual position overrides
  // that land outside the auto-computed grid for free
  let minX = 0
  let minY = 0
  let maxX = boxWidth
  let maxY = DIM_HEIGHT
  for (const p of [...Object.values(paramPos), ...Object.values(weakAttrPos)]) {
    minX = Math.min(minX, p.x - LABEL_PAD)
    minY = Math.min(minY, p.y - LABEL_PAD)
    maxX = Math.max(maxX, p.x + LABEL_PAD)
    maxY = Math.max(maxY, p.y + LABEL_PAD)
  }

  return {
    paramPos,
    weakAttrPos,
    hierarchyChipPos,
    boxWidth,
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}
