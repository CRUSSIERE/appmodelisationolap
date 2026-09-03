import type { SchemaDispatch } from './state'
import type { Dimension, Schema } from './types'

export const factKey = (factId: string) => `fact:${factId}`
export const dimKey = (dimId: string) => `dim:${dimId}`
export const paramKey = (dimId: string, paramId: string) => `param:${dimId}:${paramId}`
export const weakAttrKey = (dimId: string, paramId: string, waId: string) =>
  `wa:${dimId}:${paramId}:${waId}`
export const hierarchyKey = (dimId: string, hierarchyId: string) => `hier:${dimId}:${hierarchyId}`
export const edgeKey = (dimId: string, from: string, to: string) => `edge:${dimId}:${from}:${to}`
export const measureKey = (factId: string, measureId: string) => `measure:${factId}:${measureId}`

/** id of the side-panel field that shows this selected element, so a canvas
 * click can scroll/focus it there. Mirrors the `*-name-input-*` id scheme
 * SidePanel already uses for the rename shortcut. Edges have no panel row
 * of their own (they're drawn as connectors between two parameter rows). */
export function sidePanelElementId(key: string): string | null {
  const [kind, ...rest] = key.split(':')
  switch (kind) {
    case 'dim':
      return `dim-name-input-${rest[0]}`
    case 'fact':
      return `fact-name-input-${rest[0]}`
    case 'param':
      return `param-name-input-${rest[1]}`
    case 'wa':
      return `wa-name-input-${rest[2]}`
    case 'hier':
      return `hier-name-input-${rest[1]}`
    case 'measure':
      return `measure-name-input-${rest[1]}`
    default:
      return null
  }
}

export function selectOnly(key: string): Set<string> {
  return new Set([key])
}

export function toggleInSelection(prev: Set<string>, key: string): Set<string> {
  const next = new Set(prev)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

function hierarchiesOnEdge(dim: Dimension, from: string, to: string) {
  return dim.hierarchies.filter((h) => h.path.some((p, i) => p === from && h.path[i + 1] === to))
}

/** deletes every selected element, adapting the action to what was
 * selected: a trait removes that level from the hierarchies drawing it, a
 * hierarchy chip removes the whole hierarchy, a dimension/fact removes
 * itself (and, implicitly, everything it contains). */
export function deleteSelection(schema: Schema, selection: Set<string>, dispatch: SchemaDispatch) {
  const dimIds: string[] = []
  const factIds: string[] = []
  for (const key of selection) {
    const [kind, ...rest] = key.split(':')
    switch (kind) {
      case 'dim':
        dimIds.push(rest[0])
        break
      case 'fact':
        factIds.push(rest[0])
        break
      case 'param':
        dispatch({ type: 'DELETE_PARAMETER', dimId: rest[0], paramId: rest[1] })
        break
      case 'wa':
        dispatch({
          type: 'DELETE_WEAK_ATTRIBUTE',
          dimId: rest[0],
          paramId: rest[1],
          weakAttrId: rest[2],
        })
        break
      case 'hier':
        dispatch({ type: 'DELETE_HIERARCHY', dimId: rest[0], hierarchyId: rest[1] })
        break
      case 'edge': {
        const [dimId, from, to] = rest
        const dim = schema.dimensions.find((d) => d.id === dimId)
        if (!dim) break
        const hierarchyIds = hierarchiesOnEdge(dim, from, to).map((h) => h.id)
        if (hierarchyIds.length > 0) {
          dispatch({ type: 'REMOVE_LEVEL_FROM_HIERARCHIES', dimId, hierarchyIds, paramId: to })
        }
        break
      }
      case 'measure':
        dispatch({ type: 'DELETE_MEASURE', factId: rest[0], measureId: rest[1] })
        break
      default:
        break
    }
  }
  // dimensions/facts last: deleting one makes any DELETE_PARAMETER/etc.
  // dispatched above for its own contents a harmless no-op instead of an error
  for (const dimId of dimIds) {
    dispatch({ type: 'DELETE_DIMENSION', dimId })
  }
  for (const factId of factIds) {
    dispatch({ type: 'DELETE_FACT', factId })
  }
}

/** duplicates the hierarchy each selected chip or trait belongs to (a trait
 * shared by several hierarchies duplicates all of them), deduplicated so a
 * hierarchy reachable from multiple selected keys is only cloned once. */
export function duplicateSelection(
  schema: Schema,
  selection: Set<string>,
  dispatch: SchemaDispatch,
) {
  const done = new Set<string>()
  const dup = (dimId: string, hierarchyId: string) => {
    const dedupeKey = `${dimId}:${hierarchyId}`
    if (done.has(dedupeKey)) return
    done.add(dedupeKey)
    dispatch({ type: 'DUPLICATE_HIERARCHY', dimId, hierarchyId })
  }
  for (const key of selection) {
    const [kind, ...rest] = key.split(':')
    if (kind === 'hier') {
      dup(rest[0], rest[1])
    } else if (kind === 'edge') {
      const [dimId, from, to] = rest
      const dim = schema.dimensions.find((d) => d.id === dimId)
      if (!dim) continue
      for (const h of hierarchiesOnEdge(dim, from, to)) dup(dimId, h.id)
    }
  }
}
