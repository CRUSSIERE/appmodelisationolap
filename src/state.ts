import { useReducer } from 'react'
import { makeId } from './ids'
import type { Dimension, Hierarchy, Parameter, Schema } from './types'

export type Action =
  | { type: 'IMPORT_SCHEMA'; schema: Schema }
  | { type: 'ADD_DIMENSION'; x: number; y: number }
  | { type: 'MOVE_DIMENSION'; dimId: string; x: number; y: number }
  | { type: 'DELETE_DIMENSION'; dimId: string }
  | { type: 'RENAME_DIMENSION'; dimId: string; name: string }
  | { type: 'MOVE_FACT'; x: number; y: number }
  | { type: 'RENAME_FACT'; name: string }
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
  | { type: 'ADD_MEASURE' }
  | { type: 'RENAME_MEASURE'; measureId: string; name: string }
  | { type: 'DELETE_MEASURE'; measureId: string }
  | { type: 'RENAME_PARAMETER'; dimId: string; paramId: string; name: string }
  | { type: 'ADD_WEAK_ATTRIBUTE'; dimId: string; paramId: string }
  | {
      type: 'RENAME_WEAK_ATTRIBUTE'
      dimId: string
      paramId: string
      weakAttrId: string
      name: string
    }
  | {
      type: 'DELETE_WEAK_ATTRIBUTE'
      dimId: string
      paramId: string
      weakAttrId: string
    }
  | { type: 'ADD_LEVEL_ABOVE'; dimId: string; hierarchyId: string }
  | { type: 'DELETE_PARAMETER'; dimId: string; paramId: string }
  | { type: 'ADD_HIERARCHY'; dimId: string }
  | { type: 'RENAME_HIERARCHY'; dimId: string; hierarchyId: string; name: string }
  | { type: 'DELETE_HIERARCHY'; dimId: string; hierarchyId: string }

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
      return { ...schema, dimensions: [...schema.dimensions, dim] }
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
      }

    case 'RENAME_DIMENSION':
      return updateDim(schema, action.dimId, (d) => ({
        ...d,
        name: action.name,
      }))

    case 'MOVE_FACT':
      return {
        ...schema,
        fact: { ...schema.fact, position: { x: action.x, y: action.y } },
      }

    case 'RENAME_FACT':
      return { ...schema, fact: { ...schema.fact, name: action.name } }

    case 'ADD_MEASURE':
      return {
        ...schema,
        fact: {
          ...schema.fact,
          measures: [
            ...schema.fact.measures,
            { id: makeId('m'), name: 'nouvelle_mesure' },
          ],
        },
      }

    case 'RENAME_MEASURE':
      return {
        ...schema,
        fact: {
          ...schema.fact,
          measures: schema.fact.measures.map((m) =>
            m.id === action.measureId ? { ...m, name: action.name } : m,
          ),
        },
      }

    case 'DELETE_MEASURE':
      return {
        ...schema,
        fact: {
          ...schema.fact,
          measures: schema.fact.measures.filter(
            (m) => m.id !== action.measureId,
          ),
        },
      }

    case 'RENAME_PARAMETER':
      return updateDim(schema, action.dimId, (d) =>
        updateParam(d, action.paramId, (p) => ({ ...p, name: action.name })),
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
        if (action.paramId === d.keyParameterId) return d
        const trimmed = {
          ...d,
          // only trim a hierarchy where the deleted param is its terminal
          // node — it may also appear mid-path in another hierarchy that
          // shares this trunk, and that one must stay intact
          hierarchies: d.hierarchies.map((h) =>
            h.path[h.path.length - 1] === action.paramId
              ? { ...h, path: h.path.slice(0, -1) }
              : h,
          ),
        }
        return pruneOrphanParameters(trimmed)
      })

    case 'ADD_HIERARCHY':
      return updateDim(schema, action.dimId, (d) => ({
        ...d,
        hierarchies: [
          ...d.hierarchies,
          { id: makeId('h'), name: 'NOUVELLE_HIERARCHIE', path: [d.keyParameterId] },
        ],
      }))

    case 'RENAME_HIERARCHY':
      return updateDim(schema, action.dimId, (d) =>
        updateHierarchy(d, action.hierarchyId, (h) => ({
          ...h,
          name: action.name,
        })),
      )

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

    default:
      return schema
  }
}

export function useSchema(initial: Schema) {
  return useReducer(schemaReducer, initial)
}
