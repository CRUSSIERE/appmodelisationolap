import { makeId } from './ids'
import type {
  AttributeDataType,
  Dimension,
  Fact,
  Hierarchy,
  HierarchyLinkType,
  Parameter,
  Schema,
} from './types'

/** dispatch that accepts an optional coalesce key: consecutive dispatches
 * sharing the same key merge into a single undo step (see history.ts) */
export type SchemaDispatch = (action: Action, coalesceKey?: string) => void

export type Action =
  | { type: 'IMPORT_SCHEMA'; schema: Schema }
  | { type: 'ADD_DIMENSION'; x: number; y: number }
  | { type: 'MOVE_DIMENSION'; dimId: string; x: number; y: number }
  | { type: 'DELETE_DIMENSION'; dimId: string }
  | { type: 'RENAME_DIMENSION'; dimId: string; name: string }
  | { type: 'ADD_FACT'; x: number; y: number }
  | { type: 'DELETE_FACT'; factId: string }
  | { type: 'DUPLICATE_FACT'; factId: string }
  | { type: 'CONNECT_FACT_DIMENSION'; factId: string; dimId: string }
  | { type: 'DISCONNECT_FACT_DIMENSION'; factId: string; dimId: string }
  | { type: 'MOVE_FACT'; factId: string; x: number; y: number }
  | { type: 'RENAME_FACT'; factId: string; name: string }
  | { type: 'MOVE_PARAMETER'; dimId: string; paramId: string; x: number; y: number }
  | {
      type: 'MOVE_WEAK_ATTRIBUTE'
      dimId: string
      paramId: string
      weakAttrId: string
      x: number
      y: number
    }
  | { type: 'MOVE_HIERARCHY_CHIP'; dimId: string; hierarchyId: string; x: number; y: number }
  | { type: 'ADD_MEASURE'; factId: string }
  | { type: 'RENAME_MEASURE'; factId: string; measureId: string; name: string }
  | { type: 'DELETE_MEASURE'; factId: string; measureId: string }
  | { type: 'DUPLICATE_MEASURE'; factId: string; measureId: string }
  | { type: 'SET_MEASURE_DATA_TYPE'; factId: string; measureId: string; dataType: AttributeDataType }
  | { type: 'RENAME_PARAMETER'; dimId: string; paramId: string; name: string }
  | { type: 'SET_PARAMETER_DATA_TYPE'; dimId: string; paramId: string; dataType: AttributeDataType }
  | { type: 'ADD_WEAK_ATTRIBUTE'; dimId: string; paramId: string }
  | {
      type: 'RENAME_WEAK_ATTRIBUTE'
      dimId: string
      paramId: string
      weakAttrId: string
      name: string
    }
  | {
      type: 'SET_WEAK_ATTRIBUTE_DATA_TYPE'
      dimId: string
      paramId: string
      weakAttrId: string
      dataType: AttributeDataType
    }
  | {
      type: 'DELETE_WEAK_ATTRIBUTE'
      dimId: string
      paramId: string
      weakAttrId: string
    }
  | { type: 'ADD_LEVEL_ABOVE'; dimId: string; hierarchyId: string; existingParamId?: string }
  | { type: 'DELETE_PARAMETER'; dimId: string; paramId: string }
  | { type: 'ADD_HIERARCHY'; dimId: string; fromParamId?: string }
  | { type: 'RENAME_HIERARCHY'; dimId: string; hierarchyId: string; name: string }
  | { type: 'DELETE_HIERARCHY'; dimId: string; hierarchyId: string }
  | { type: 'DUPLICATE_HIERARCHY'; dimId: string; hierarchyId: string }
  | {
      type: 'SET_HIERARCHY_LINK_TYPE'
      dimId: string
      hierarchyIds: string[]
      from: string
      to: string
      linkType: HierarchyLinkType
    }
  | {
      type: 'REMOVE_LEVEL_FROM_HIERARCHIES'
      dimId: string
      hierarchyIds: string[]
      paramId: string
    }
  | { type: 'DUPLICATE_DIMENSION'; dimId: string }
  | { type: 'DUPLICATE_PARAMETER'; dimId: string; paramId: string }
  | { type: 'DUPLICATE_WEAK_ATTRIBUTE'; dimId: string; paramId: string; weakAttrId: string }

function updateDim(
  schema: Schema,
  dimId: string,
  fn: (dim: Dimension) => Dimension,
): Schema {
  return {
    ...schema,
    dimensions: schema.dimensions.map((d) => (d.id === dimId ? fn(d) : d)),
  }
}

function updateFact(schema: Schema, factId: string, fn: (fact: Fact) => Fact): Schema {
  return {
    ...schema,
    facts: schema.facts.map((f) => (f.id === factId ? fn(f) : f)),
  }
}

function updateParam(
  dim: Dimension,
  paramId: string,
  fn: (p: Parameter) => Parameter,
): Dimension {
  return {
    ...dim,
    parameters: dim.parameters.map((p) => (p.id === paramId ? fn(p) : p)),
  }
}

function updateHierarchy(
  dim: Dimension,
  hierarchyId: string,
  fn: (h: Hierarchy) => Hierarchy,
): Dimension {
  return {
    ...dim,
    hierarchies: dim.hierarchies.map((h) =>
      h.id === hierarchyId ? fn(h) : h,
    ),
  }
}

/** removes dimension parameters no longer referenced by any hierarchy path (and not the key) */
function pruneOrphanParameters(dim: Dimension): Dimension {
  const referenced = new Set(dim.hierarchies.flatMap((h) => h.path))
  referenced.add(dim.keyParameterId)
  return {
    ...dim,
    parameters: dim.parameters.filter((p) => referenced.has(p.id)),
  }
}

function hierarchyEdges(h: Hierarchy): string[] {
  return h.path.slice(0, -1).map((from, i) => `${from}->${h.path[i + 1]}`)
}

/** the prefix (key...paramId) of the first hierarchy whose path reaches
 * paramId — used to seed a new hierarchy branching off an existing
 * attribute. Falls back to just the key when paramId is itself the key or
 * unreferenced (shouldn't happen: every non-key parameter lives in at least
 * one hierarchy path, see pruneOrphanParameters). */
function findPrefixToParam(dim: Dimension, paramId: string): string[] {
  if (paramId === dim.keyParameterId) return [dim.keyParameterId]
  for (const h of dim.hierarchies) {
    const idx = h.path.indexOf(paramId)
    if (idx !== -1) return h.path.slice(0, idx + 1)
  }
  return [dim.keyParameterId]
}

/** true if adding edge from->to would create a cycle in the dimension-wide
 * graph formed by the union of every hierarchy's edges (i.e. `to` can
 * already reach `from`) */
export function wouldCreateCycle(dim: Dimension, from: string, to: string): boolean {
  const adjacency = new Map<string, string[]>()
  for (const h of dim.hierarchies) {
    for (let i = 0; i < h.path.length - 1; i++) {
      const a = h.path[i]
      const b = h.path[i + 1]
      adjacency.set(a, [...(adjacency.get(a) ?? []), b])
    }
  }
  const stack = [to]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node === from) return true
    if (seen.has(node)) continue
    seen.add(node)
    stack.push(...(adjacency.get(node) ?? []))
  }
  return false
}

/** drops a hierarchy once every one of its edges is also carried by another
 * sibling hierarchy — it no longer contributes anything of its own (mirrors
 * GraphicOLAP's "redundant shared-prefix hierarchy" cleanup on deletion).
 * Only hierarchies in `touchedIds` (the ones the triggering action actually
 * modified) are candidates for removal — an untouched hierarchy that already
 * happened to share every edge with a sibling (e.g. one just cloned via
 * "Dupliquer") must not be swept away as a side effect of an unrelated edit
 * elsewhere in the dimension. */
function pruneRedundantHierarchies(dim: Dimension, touchedIds: Set<string>): Dimension {
  const kept = dim.hierarchies.filter((h) => {
    if (!touchedIds.has(h.id)) return true
    if (h.path.length <= 1) return false
    const edges = hierarchyEdges(h)
    return !edges.every((edge) =>
      dim.hierarchies.some((other) => other.id !== h.id && hierarchyEdges(other).includes(edge)),
    )
  })
  return kept.length === dim.hierarchies.length ? dim : { ...dim, hierarchies: kept }
}

/** removes every occurrence of `paramId` from a hierarchy's path (wherever it
 * sits, not just at the terminal), dropping any per-edge link type that
 * referenced it */
function removeParamFromHierarchyPath(h: Hierarchy, paramId: string): Hierarchy {
  if (!h.path.includes(paramId)) return h
  const path = h.path.filter((id) => id !== paramId)
  const linkTypes = h.linkTypes
    ? Object.fromEntries(
        Object.entries(h.linkTypes).filter(([edge]) => {
          const [from, to] = edge.split('->')
          return from !== paramId && to !== paramId
        }),
      )
    : undefined
  return { ...h, path, linkTypes }
}

export function schemaReducer(schema: Schema, action: Action): Schema {
  switch (action.type) {
    case 'IMPORT_SCHEMA':
      return action.schema

    case 'ADD_DIMENSION': {
      const keyId = makeId('p')
      const dim: Dimension = {
        id: makeId('dim'),
        name: 'NOUVELLE_DIMENSION',
        position: { x: action.x, y: action.y },
        keyParameterId: keyId,
        parameters: [{ id: keyId, name: 'cle', weakAttributes: [] }],
        hierarchies: [],
      }
      // a schema with a single fact keeps behaving like a plain star: new
      // dimensions auto-connect. With several facts (constellation), the
      // user picks connections explicitly via the dimension's context menu.
      const facts =
        schema.facts.length === 1
          ? [{ ...schema.facts[0], dimensionIds: [...schema.facts[0].dimensionIds, dim.id] }]
          : schema.facts
      return { ...schema, dimensions: [...schema.dimensions, dim], facts }
    }

    case 'MOVE_DIMENSION':
      return updateDim(schema, action.dimId, (d) => ({
        ...d,
        position: { x: action.x, y: action.y },
      }))

    case 'DELETE_DIMENSION':
      return {
        ...schema,
        dimensions: schema.dimensions.filter((d) => d.id !== action.dimId),
        facts: schema.facts.map((f) => ({
          ...f,
          dimensionIds: f.dimensionIds.filter((id) => id !== action.dimId),
        })),
      }

    case 'RENAME_DIMENSION':
      return updateDim(schema, action.dimId, (d) => ({
        ...d,
        name: action.name,
      }))

    case 'ADD_FACT': {
      const fact: Fact = {
        id: makeId('fact'),
        name: 'NOUVEAU_FAIT',
        position: { x: action.x, y: action.y },
        measures: [],
        dimensionIds: [],
      }
      return { ...schema, facts: [...schema.facts, fact] }
    }

    case 'DELETE_FACT':
      return { ...schema, facts: schema.facts.filter((f) => f.id !== action.factId) }

    case 'DUPLICATE_FACT': {
      const source = schema.facts.find((f) => f.id === action.factId)
      if (!source) return schema
      const copy: Fact = {
        ...source,
        id: makeId('fact'),
        name: `${source.name}_copie`,
        position: { x: source.position.x + 40, y: source.position.y + 40 },
        measures: source.measures.map((m) => ({ ...m, id: makeId('m') })),
        dimensionIds: [...source.dimensionIds],
      }
      return { ...schema, facts: [...schema.facts, copy] }
    }

    case 'CONNECT_FACT_DIMENSION':
      return updateFact(schema, action.factId, (f) =>
        f.dimensionIds.includes(action.dimId)
          ? f
          : { ...f, dimensionIds: [...f.dimensionIds, action.dimId] },
      )

    case 'DISCONNECT_FACT_DIMENSION':
      return updateFact(schema, action.factId, (f) => ({
        ...f,
        dimensionIds: f.dimensionIds.filter((id) => id !== action.dimId),
      }))

    case 'MOVE_FACT':
      return updateFact(schema, action.factId, (f) => ({
        ...f,
        position: { x: action.x, y: action.y },
      }))

    case 'RENAME_FACT':
      return updateFact(schema, action.factId, (f) => ({ ...f, name: action.name }))

    case 'ADD_MEASURE':
      return updateFact(schema, action.factId, (f) => ({
        ...f,
        measures: [...f.measures, { id: makeId('m'), name: 'nouvelle_mesure' }],
      }))

    case 'RENAME_MEASURE':
      return updateFact(schema, action.factId, (f) => ({
        ...f,
        measures: f.measures.map((m) =>
          m.id === action.measureId ? { ...m, name: action.name } : m,
        ),
      }))

    case 'DELETE_MEASURE':
      return updateFact(schema, action.factId, (f) => ({
        ...f,
        measures: f.measures.filter((m) => m.id !== action.measureId),
      }))

    case 'DUPLICATE_MEASURE':
      return updateFact(schema, action.factId, (f) => {
        const source = f.measures.find((m) => m.id === action.measureId)
        if (!source) return f
        return {
          ...f,
          measures: [...f.measures, { ...source, id: makeId('m'), name: `${source.name}_copie` }],
        }
      })

    case 'SET_MEASURE_DATA_TYPE':
      return updateFact(schema, action.factId, (f) => ({
        ...f,
        measures: f.measures.map((m) =>
          m.id === action.measureId ? { ...m, dataType: action.dataType } : m,
        ),
      }))

    case 'RENAME_PARAMETER':
      return updateDim(schema, action.dimId, (d) =>
        updateParam(d, action.paramId, (p) => ({ ...p, name: action.name })),
      )

    case 'SET_PARAMETER_DATA_TYPE':
      return updateDim(schema, action.dimId, (d) =>
        updateParam(d, action.paramId, (p) => ({ ...p, dataType: action.dataType })),
      )

    case 'MOVE_PARAMETER':
      return updateDim(schema, action.dimId, (d) =>
        updateParam(d, action.paramId, (p) => ({
          ...p,
          position: { x: action.x, y: action.y },
        })),
      )

    case 'ADD_WEAK_ATTRIBUTE':
      return updateDim(schema, action.dimId, (d) =>
        updateParam(d, action.paramId, (p) => ({
          ...p,
          weakAttributes: [
            ...p.weakAttributes,
            { id: makeId('wa'), name: 'nouvel_attribut' },
          ],
        })),
      )

    case 'RENAME_WEAK_ATTRIBUTE':
      return updateDim(schema, action.dimId, (d) =>
        updateParam(d, action.paramId, (p) => ({
          ...p,
          weakAttributes: p.weakAttributes.map((wa) =>
            wa.id === action.weakAttrId ? { ...wa, name: action.name } : wa,
          ),
        })),
      )

    case 'SET_WEAK_ATTRIBUTE_DATA_TYPE':
      return updateDim(schema, action.dimId, (d) =>
        updateParam(d, action.paramId, (p) => ({
          ...p,
          weakAttributes: p.weakAttributes.map((wa) =>
            wa.id === action.weakAttrId ? { ...wa, dataType: action.dataType } : wa,
          ),
        })),
      )

    case 'MOVE_WEAK_ATTRIBUTE':
      return updateDim(schema, action.dimId, (d) =>
        updateParam(d, action.paramId, (p) => ({
          ...p,
          weakAttributes: p.weakAttributes.map((wa) =>
            wa.id === action.weakAttrId
              ? { ...wa, position: { x: action.x, y: action.y } }
              : wa,
          ),
        })),
      )

    case 'DELETE_WEAK_ATTRIBUTE':
      return updateDim(schema, action.dimId, (d) =>
        updateParam(d, action.paramId, (p) => ({
          ...p,
          weakAttributes: p.weakAttributes.filter(
            (wa) => wa.id !== action.weakAttrId,
          ),
        })),
      )

    case 'ADD_LEVEL_ABOVE':
      return updateDim(schema, action.dimId, (d) => {
        if (action.existingParamId) {
          const h = d.hierarchies.find((h) => h.id === action.hierarchyId)
          if (!h) return d
          const paramId = action.existingParamId
          // already in this path (no-op), or linking it would make the
          // dimension-wide hierarchy graph cyclic
          if (h.path.includes(paramId)) return d
          const from = h.path[h.path.length - 1]
          if (wouldCreateCycle(d, from, paramId)) return d
          const linked = updateHierarchy(d, action.hierarchyId, (h) => ({
            ...h,
            path: [...h.path, paramId],
          }))
          // the linked-to edge may already exist wholesale on a sibling
          // hierarchy, making this one now fully redundant
          return pruneRedundantHierarchies(linked, new Set([action.hierarchyId]))
        }
        const newParam: Parameter = {
          id: makeId('p'),
          name: 'nouveau_niveau',
          weakAttributes: [],
        }
        return updateHierarchy(
          { ...d, parameters: [...d.parameters, newParam] },
          action.hierarchyId,
          (h) => ({ ...h, path: [...h.path, newParam.id] }),
        )
      })

    case 'DELETE_PARAMETER':
      return updateDim(schema, action.dimId, (d) => {
        // the root/key parameter is only removable once it's the last
        // parameter standing — GraphicOLAP forbids it while siblings exist
        const isLastParam = d.parameters.length === 1 && d.parameters[0].id === action.paramId
        if (action.paramId === d.keyParameterId && !isLastParam) return d
        if (isLastParam) {
          // no parameter left to anchor any hierarchy on
          return { ...d, parameters: [], hierarchies: [] }
        }
        const touchedIds = new Set(
          d.hierarchies.filter((h) => h.path.includes(action.paramId)).map((h) => h.id),
        )
        const trimmed = {
          ...d,
          hierarchies: d.hierarchies.map((h) => removeParamFromHierarchyPath(h, action.paramId)),
        }
        return pruneOrphanParameters(pruneRedundantHierarchies(trimmed, touchedIds))
      })

    case 'ADD_HIERARCHY':
      return updateDim(schema, action.dimId, (d) => {
        // GraphicOLAP: "Hierarchies requires at least 2 parameters"
        if (d.parameters.length < 2) return d
        const path = action.fromParamId ? findPrefixToParam(d, action.fromParamId) : [d.keyParameterId]
        return {
          ...d,
          hierarchies: [
            ...d.hierarchies,
            { id: makeId('h'), name: 'NOUVELLE_HIERARCHIE', path },
          ],
        }
      })

    case 'RENAME_HIERARCHY':
      return updateDim(schema, action.dimId, (d) =>
        updateHierarchy(d, action.hierarchyId, (h) => ({
          ...h,
          name: action.name,
        })),
      )

    case 'SET_HIERARCHY_LINK_TYPE': {
      const targetIds = new Set(action.hierarchyIds)
      return updateDim(schema, action.dimId, (d) => ({
        ...d,
        hierarchies: d.hierarchies.map((h) => {
          if (!targetIds.has(h.id)) return h
          const edgeExists = h.path.some((p, i) => p === action.from && h.path[i + 1] === action.to)
          if (!edgeExists) return h
          return {
            ...h,
            linkTypes: { ...h.linkTypes, [`${action.from}->${action.to}`]: action.linkType },
          }
        }),
      }))
    }

    case 'MOVE_HIERARCHY_CHIP':
      return updateDim(schema, action.dimId, (d) =>
        updateHierarchy(d, action.hierarchyId, (h) => ({
          ...h,
          chipPosition: { x: action.x, y: action.y },
        })),
      )

    case 'DELETE_HIERARCHY':
      return updateDim(schema, action.dimId, (d) =>
        pruneOrphanParameters({
          ...d,
          hierarchies: d.hierarchies.filter(
            (h) => h.id !== action.hierarchyId,
          ),
        }),
      )

    case 'DUPLICATE_HIERARCHY':
      return updateDim(schema, action.dimId, (d) => {
        const source = d.hierarchies.find((h) => h.id === action.hierarchyId)
        if (!source) return d
        const copy: Hierarchy = {
          id: makeId('h'),
          name: `${source.name}_copie`,
          path: [...source.path],
          linkTypes: source.linkTypes ? { ...source.linkTypes } : undefined,
        }
        return { ...d, hierarchies: [...d.hierarchies, copy] }
      })

    case 'DUPLICATE_DIMENSION': {
      const source = schema.dimensions.find((d) => d.id === action.dimId)
      if (!source) return schema
      // remap every id so the clone shares nothing with the original, then
      // rewrite parameter/hierarchy references through the remap table
      const paramIdMap = new Map(source.parameters.map((p) => [p.id, makeId('p')]))
      const parameters: Parameter[] = source.parameters.map((p) => ({
        ...p,
        id: paramIdMap.get(p.id)!,
        weakAttributes: p.weakAttributes.map((wa) => ({ ...wa, id: makeId('wa') })),
      }))
      const hierarchies: Hierarchy[] = source.hierarchies.map((h) => ({
        ...h,
        id: makeId('h'),
        path: h.path.map((pid) => paramIdMap.get(pid)!),
        linkTypes: h.linkTypes
          ? Object.fromEntries(
              Object.entries(h.linkTypes).map(([edge, type]) => {
                const [from, to] = edge.split('->')
                return [`${paramIdMap.get(from)}->${paramIdMap.get(to)}`, type]
              }),
            )
          : undefined,
      }))
      const copy: Dimension = {
        ...source,
        id: makeId('dim'),
        name: `${source.name}_copie`,
        position: { x: source.position.x + 40, y: source.position.y + 40 },
        keyParameterId: paramIdMap.get(source.keyParameterId)!,
        parameters,
        hierarchies,
      }
      return {
        ...schema,
        dimensions: [...schema.dimensions, copy],
        facts: schema.facts.map((f) =>
          f.dimensionIds.includes(source.id)
            ? { ...f, dimensionIds: [...f.dimensionIds, copy.id] }
            : f,
        ),
      }
    }

    case 'DUPLICATE_PARAMETER':
      return updateDim(schema, action.dimId, (d) => {
        const source = d.parameters.find((p) => p.id === action.paramId)
        if (!source) return d
        const copy: Parameter = {
          ...source,
          id: makeId('p'),
          name: `${source.name}_copie`,
          weakAttributes: source.weakAttributes.map((wa) => ({ ...wa, id: makeId('wa') })),
        }
        return { ...d, parameters: [...d.parameters, copy] }
      })

    case 'DUPLICATE_WEAK_ATTRIBUTE':
      return updateDim(schema, action.dimId, (d) =>
        updateParam(d, action.paramId, (p) => {
          const source = p.weakAttributes.find((wa) => wa.id === action.weakAttrId)
          if (!source) return p
          const copy = { ...source, id: makeId('wa'), name: `${source.name}_copie` }
          return { ...p, weakAttributes: [...p.weakAttributes, copy] }
        }),
      )

    case 'REMOVE_LEVEL_FROM_HIERARCHIES': {
      const targetIds = new Set(action.hierarchyIds)
      return updateDim(schema, action.dimId, (d) =>
        pruneOrphanParameters(
          pruneRedundantHierarchies(
            {
              ...d,
              hierarchies: d.hierarchies.map((h) =>
                targetIds.has(h.id) ? removeParamFromHierarchyPath(h, action.paramId) : h,
              ),
            },
            targetIds,
          ),
        ),
      )
    }

    default:
      return schema
  }
}
