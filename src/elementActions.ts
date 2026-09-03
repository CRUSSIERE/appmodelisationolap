import type { MenuItem } from './components/ContextMenu'
import type { SchemaDispatch } from './state'
import { wouldCreateCycle } from './state'
import type { Dimension, Fact, Hierarchy, HierarchyLinkType, Measure, Parameter, Schema, WeakAttribute } from './types'

const LINK_TYPE_LABELS: Record<HierarchyLinkType, string> = {
  strict: 'Stricte (1,n → 1,1)',
  non_strict: 'Non stricte (1,n → 1,n)',
  strict_incomplete: 'Stricte incomplète (0,n → 0,1)',
  non_strict_incomplete: 'Non stricte incomplète (0,n → 0,n)',
}

function copyItem(name: string): MenuItem {
  return {
    label: 'Copier le nom',
    onClick: () => {
      navigator.clipboard.writeText(name).catch(() => {})
    },
  }
}

function renameItem(onRename?: () => void): MenuItem[] {
  return onRename ? [{ label: 'Renommer', onClick: onRename }] : []
}

export function dimensionMenuItems(
  schema: Schema,
  dim: Dimension,
  dispatch: SchemaDispatch,
  onRename?: () => void,
): MenuItem[] {
  return [
    ...renameItem(onRename),
    { label: 'Dupliquer', onClick: () => dispatch({ type: 'DUPLICATE_DIMENSION', dimId: dim.id }) },
    copyItem(dim.name),
    ...factConnectionMenuItems(schema, dim, dispatch),
    {
      label: 'Supprimer',
      danger: true,
      onClick: () => {
        if (window.confirm(`Supprimer la dimension ${dim.name} ?`)) {
          dispatch({ type: 'DELETE_DIMENSION', dimId: dim.id })
        }
      },
    },
  ]
}

export function factMenuItems(
  fact: Fact,
  dispatch: SchemaDispatch,
  onRename?: () => void,
): MenuItem[] {
  return [
    ...renameItem(onRename),
    { label: 'Dupliquer', onClick: () => dispatch({ type: 'DUPLICATE_FACT', factId: fact.id }) },
    copyItem(fact.name),
    {
      label: 'Supprimer',
      danger: true,
      onClick: () => {
        if (window.confirm(`Supprimer le fait ${fact.name} ?`)) {
          dispatch({ type: 'DELETE_FACT', factId: fact.id })
        }
      },
    },
  ]
}

export function measureMenuItems(
  factId: string,
  measure: Measure,
  dispatch: SchemaDispatch,
  onRename?: () => void,
): MenuItem[] {
  return [
    ...renameItem(onRename),
    {
      label: 'Dupliquer',
      onClick: () => dispatch({ type: 'DUPLICATE_MEASURE', factId, measureId: measure.id }),
    },
    copyItem(measure.name),
    {
      label: 'Supprimer',
      danger: true,
      onClick: () => dispatch({ type: 'DELETE_MEASURE', factId, measureId: measure.id }),
    },
  ]
}

/** connect/disconnect items shown on a dimension's menu once the schema has
 * more than one fact (a single-fact schema stays a plain always-connected
 * star, matching prior behavior) */
export function factConnectionMenuItems(
  schema: Schema,
  dim: Dimension,
  dispatch: SchemaDispatch,
): MenuItem[] {
  if (schema.facts.length <= 1) return []
  return schema.facts.map((fact) => {
    const connected = fact.dimensionIds.includes(dim.id)
    return {
      label: connected ? `Déconnecter de ${fact.name}` : `Connecter à ${fact.name}`,
      onClick: () =>
        dispatch({
          type: connected ? 'DISCONNECT_FACT_DIMENSION' : 'CONNECT_FACT_DIMENSION',
          factId: fact.id,
          dimId: dim.id,
        }),
    }
  })
}

/** cardinality/completeness submenu for a hierarchy edge (one item per
 * GraphicOLAP link type), applied to every hierarchy sharing that edge */
export function hierarchyLinkTypeMenuItems(
  dimId: string,
  hierarchyIds: string[],
  from: string,
  to: string,
  dispatch: SchemaDispatch,
): MenuItem[] {
  return (Object.keys(LINK_TYPE_LABELS) as HierarchyLinkType[]).map((linkType) => ({
    label: LINK_TYPE_LABELS[linkType],
    onClick: () => dispatch({ type: 'SET_HIERARCHY_LINK_TYPE', dimId, hierarchyIds, from, to, linkType }),
  }))
}

export function paramBaseMenuItems(
  dim: Dimension,
  param: Parameter,
  dispatch: SchemaDispatch,
  onRename?: () => void,
): MenuItem[] {
  const isKey = param.id === dim.keyParameterId
  const items: MenuItem[] = [
    ...renameItem(onRename),
    {
      label: 'Dupliquer',
      onClick: () => dispatch({ type: 'DUPLICATE_PARAMETER', dimId: dim.id, paramId: param.id }),
    },
    copyItem(param.name),
  ]
  if (!isKey) {
    items.push({
      label: 'Supprimer',
      danger: true,
      onClick: () => dispatch({ type: 'DELETE_PARAMETER', dimId: dim.id, paramId: param.id }),
    })
  }
  return items
}

/** hierarchy-related actions anchored on a parameter: starting a new
 * hierarchy from it, and — for every hierarchy it terminates — adding a
 * level above it (new, or linking an existing dimension parameter to
 * create a shared/converging level). Shared by the canvas context menu and
 * the side panel's parameter kebab. */
export function paramHierarchyMenuItems(
  dim: Dimension,
  paramId: string,
  dispatch: SchemaDispatch,
): MenuItem[] {
  const isKey = paramId === dim.keyParameterId
  const items: MenuItem[] = []
  if (dim.parameters.length >= 2) {
    items.push({
      label: isKey
        ? dim.hierarchies.length === 0
          ? 'Ajouter une hiérarchie'
          : 'Ajouter une hiérarchie alternative'
        : 'Créer une hiérarchie depuis ici',
      onClick: () =>
        dispatch({
          type: 'ADD_HIERARCHY',
          dimId: dim.id,
          fromParamId: isKey ? undefined : paramId,
        }),
    })
  }
  const terminalHierarchies = dim.hierarchies.filter(
    (h) => h.path[h.path.length - 1] === paramId,
  )
  const otherParams = dim.parameters.filter((p) => p.id !== paramId)
  for (const h of terminalHierarchies) {
    const suffix = terminalHierarchies.length > 1 ? ` (${h.name})` : ''
    items.push({
      label: `Ajouter un niveau au-dessus${suffix}`,
      onClick: () => dispatch({ type: 'ADD_LEVEL_ABOVE', dimId: dim.id, hierarchyId: h.id }),
    })
    const linkable = otherParams.filter(
      (p) => !h.path.includes(p.id) && !wouldCreateCycle(dim, paramId, p.id),
    )
    for (const p of linkable) {
      items.push({
        label: `Lier "${p.name}" au-dessus${suffix}`,
        onClick: () =>
          dispatch({
            type: 'ADD_LEVEL_ABOVE',
            dimId: dim.id,
            hierarchyId: h.id,
            existingParamId: p.id,
          }),
      })
    }
  }
  return items
}

export function weakAttrMenuItems(
  dim: Dimension,
  param: Parameter,
  wa: WeakAttribute,
  dispatch: SchemaDispatch,
  onRename?: () => void,
): MenuItem[] {
  return [
    ...renameItem(onRename),
    {
      label: 'Dupliquer',
      onClick: () =>
        dispatch({
          type: 'DUPLICATE_WEAK_ATTRIBUTE',
          dimId: dim.id,
          paramId: param.id,
          weakAttrId: wa.id,
        }),
    },
    copyItem(wa.name),
    {
      label: 'Supprimer',
      danger: true,
      onClick: () =>
        dispatch({
          type: 'DELETE_WEAK_ATTRIBUTE',
          dimId: dim.id,
          paramId: param.id,
          weakAttrId: wa.id,
        }),
    },
  ]
}

export function hierarchyMenuItems(
  dim: Dimension,
  hierarchy: Hierarchy,
  dispatch: SchemaDispatch,
  onRename?: () => void,
): MenuItem[] {
  return [
    ...renameItem(onRename),
    {
      label: 'Dupliquer',
      onClick: () =>
        dispatch({ type: 'DUPLICATE_HIERARCHY', dimId: dim.id, hierarchyId: hierarchy.id }),
    },
    copyItem(hierarchy.name),
    {
      label: 'Supprimer',
      danger: true,
      onClick: () => dispatch({ type: 'DELETE_HIERARCHY', dimId: dim.id, hierarchyId: hierarchy.id }),
    },
  ]
}
