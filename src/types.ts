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

/** direction the dimension's hierarchies fan out from its key parameter.
 * Set per dimension, not per hierarchy: hierarchies of a dimension share
 * their trunk parameters, which can only hold one position each. */
export type Orientation = 'right' | 'left' | 'up' | 'down'

export interface Dimension extends NamedItem {
  position: Point
  keyParameterId: string
  parameters: Parameter[]
  hierarchies: Hierarchy[]
  /** absent = 'right', the direction the editor used before this was settable */
  orientation?: Orientation
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

/** one text appearance for the whole diagram */
export interface TextStyle {
  /** CSS font-family stack */
  fontFamily: string
  /** base size in px; every label is a fixed multiple of it (see textStyle.ts) */
  fontSize: number
  color: string
}

export interface Schema {
  version: 2
  facts: Fact[]
  dimensions: Dimension[]
  /** absent = DEFAULT_TEXT_STYLE; backfilled on import */
  textStyle?: TextStyle
}
