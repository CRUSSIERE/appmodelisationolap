import type { Dimension } from './types'

export const DIM_WIDTH = 140
export const DIM_HEIGHT = 48
export const PARAM_RADIUS = 6
const COL_WIDTH = 100
const ROW_HEIGHT = 64
const WEAK_ATTR_STEP = 34

export interface Point {
  x: number
  y: number
}

export interface WeakAttrLayout extends Point {
  labelX: number
  labelY: number
}

export interface DimensionLayout {
  /** paramId -> position, local to the dimension's anchor (position.x/y = rect top-left) */
  paramPos: Record<string, Point>
  /** `${paramId}:${weakAttrId}` -> line end + label position, local coords */
  weakAttrPos: Record<string, WeakAttrLayout>
  /** hierarchyId -> chip center position, local coords */
  hierarchyChipPos: Record<string, Point>
  /** local bounding box, used to size the SVG viewport */
  width: number
  height: number
}

/**
 * Lays out a dimension's parameter tree: the key sits on the dimension's
 * right edge (col 0), each hierarchy fans out to the right. Nodes shared by
 * every hierarchy of the dimension (the trunk) land on the center row;
 * nodes only reachable through a subset of hierarchies get pulled toward
 * that subset's average row, which is what makes alternative hierarchies
 * visually bifurcate.
 */
export function layoutDimension(dim: Dimension): DimensionLayout {
  const n = dim.hierarchies.length
  const targetRow = (hIndex: number) => hIndex - (n - 1) / 2

  const paramDepth = new Map<string, number>()
  const paramRows = new Map<string, number[]>()
  let maxDepth = 0

  // the key always gets a position, even before any hierarchy is defined —
  // it's what the dimension rectangle and the fact-link line anchor to
  paramDepth.set(dim.keyParameterId, 0)
  paramRows.set(dim.keyParameterId, [0])

  dim.hierarchies.forEach((h, hIndex) => {
    h.path.forEach((paramId, depth) => {
      maxDepth = Math.max(maxDepth, depth)
      if (!paramDepth.has(paramId)) paramDepth.set(paramId, depth)
      const rows = paramRows.get(paramId) ?? []
      rows.push(targetRow(hIndex))
      paramRows.set(paramId, rows)
    })
  })

  const centerY = DIM_HEIGHT / 2
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
    paramPos[paramId] = {
      x: DIM_WIDTH + depth * COL_WIDTH,
      y: centerY + avgRow * ROW_HEIGHT,
    }
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
    if (h.chipPosition) {
      hierarchyChipPos[h.id] = h.chipPosition
      return
    }
    if (h.path.length < 1) return
    const p0 = paramPos[h.path[0]]
    const p1 = paramPos[h.path[1] ?? h.path[0]]
    if (!p0 || !p1) return
    hierarchyChipPos[h.id] = {
      x: (p0.x + p1.x) / 2,
      y: (p0.y + p1.y) / 2,
    }
  })

  const rows = [...paramRows.values()].flat()
  const minRow = Math.min(0, ...rows)
  const maxRow = Math.max(0, ...rows)
  let height = Math.max(
    DIM_HEIGHT,
    (maxRow - minRow) * ROW_HEIGHT + DIM_HEIGHT + WEAK_ATTR_STEP * 2,
  )
  let width = DIM_WIDTH + maxDepth * COL_WIDTH + WEAK_ATTR_STEP * 3

  // manual overrides can land outside the auto-computed bbox — grow to fit
  for (const p of Object.values(paramPos)) {
    width = Math.max(width, p.x + WEAK_ATTR_STEP)
    height = Math.max(height, p.y + WEAK_ATTR_STEP)
  }
  for (const wa of Object.values(weakAttrPos)) {
    width = Math.max(width, wa.x + WEAK_ATTR_STEP)
    height = Math.max(height, wa.y + WEAK_ATTR_STEP)
  }

  return { paramPos, weakAttrPos, hierarchyChipPos, width, height }
}
