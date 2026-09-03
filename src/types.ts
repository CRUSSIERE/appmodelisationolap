export interface Point {
  x: number
  y: number
}

export interface NamedItem {
  id: string
  name: string
}

/** closed 7-value set mirrored from the reference OLAP editor (GraphicOLAP) */
export type AttributeDataType =
  | 'undefined'
  | 'text'
  | 'integer'
  | 'scientific'
  | 'decimal'
  | 'date'
  | 'binary'

/** roll-up cardinality/completeness between two adjacent hierarchy levels */
export type HierarchyLinkType =
  | 'strict'
  | 'non_strict'
  | 'strict_incomplete'
  | 'non_strict_incomplete'

/** optional manual override, local to the dimension; absent = auto-layout */
export interface WeakAttribute extends NamedItem {
  position?: Point
  dataType?: AttributeDataType
}

export interface Parameter extends NamedItem {
  weakAttributes: WeakAttribute[]
  /** optional manual override, local to the dimension; absent = auto-layout */
  position?: Point
  dataType?: AttributeDataType
}

export interface Hierarchy extends NamedItem {
  /** ordered Parameter ids, path[0] must be the dimension's key parameter */
  path: string[]
  /** per-edge roll-up type keyed by "fromParamId->toParamId"; absent = 'strict' */
  linkTypes?: Record<string, HierarchyLinkType>
  /** optional manual override for the name-chip, local to the dimension; absent = auto-layout */
  chipPosition?: Point
}

export interface Dimension extends NamedItem {
  position: Point
  keyParameterId: string
  parameters: Parameter[]
  hierarchies: Hierarchy[]
}

export interface Measure extends NamedItem {
  dataType?: AttributeDataType
}

export interface Fact extends NamedItem {
  position: Point
  measures: Measure[]
  /** ids of dimensions linked to this fact (a schema can be a constellation of several facts) */
  dimensionIds: string[]
}

export interface Schema {
  version: 2
  facts: Fact[]
  dimensions: Dimension[]
}
