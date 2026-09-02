import type { MenuItem } from './components/ContextMenu'
import type { SchemaDispatch } from './state'
import type { Dimension, Hierarchy, NamedItem, Parameter, WeakAttribute } from './types'

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
  dim: Dimension,
  dispatch: SchemaDispatch,
  onRename?: () => void,
): MenuItem[] {
  return [
    ...renameItem(onRename),
    { label: 'Dupliquer', onClick: () => dispatch({ type: 'DUPLICATE_DIMENSION', dimId: dim.id }) },
    copyItem(dim.name),
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

export function factMenuItems(fact: NamedItem, onRename?: () => void): MenuItem[] {
  return [...renameItem(onRename), copyItem(fact.name)]
}

export function measureMenuItems(
  measure: NamedItem,
  dispatch: SchemaDispatch,
  onRename?: () => void,
): MenuItem[] {
  return [
    ...renameItem(onRename),
    {
      label: 'Dupliquer',
      onClick: () => dispatch({ type: 'DUPLICATE_MEASURE', measureId: measure.id }),
    },
    copyItem(measure.name),
    {
      label: 'Supprimer',
      danger: true,
      onClick: () => dispatch({ type: 'DELETE_MEASURE', measureId: measure.id }),
    },
  ]
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
