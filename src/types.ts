export interface Point {
  x: number
  y: number
}

export interface NamedItem {
  id: string
  name: string
}

/** optional manual override, local to the dimension; absent = auto-layout */
export interface WeakAttribute extends NamedItem {
  position?: Point
}

export interface Parameter extends NamedItem {
  weakAttributes: WeakAttribute[]
  /** optional manual override, local to the dimension; absent = auto-layout */
  position?: Point
}

export interface Hierarchy extends NamedItem {
  /** ordered Parameter ids, path[0] must be the dimension's key parameter */
  path: string[]
  /** optional manual override for the name-chip, local to the dimension; absent = auto-layout */
  chipPosition?: Point
}

export interface Dimension extends NamedItem {
  position: Point
  keyParameterId: string
  parameters: Parameter[]
  hierarchies: Hierarchy[]
}

export interface Fact extends NamedItem {
  position: Point
  measures: NamedItem[]
}

export interface Schema {
  version: 1
  fact: Fact
  dimensions: Dimension[]
}
