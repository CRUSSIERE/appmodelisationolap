export interface NamedItem {
  id: string
  name: string
}

export interface Parameter extends NamedItem {
  weakAttributes: NamedItem[]
}

export interface Hierarchy extends NamedItem {
  /** ordered Parameter ids, path[0] must be the dimension's key parameter */
  path: string[]
}

export interface Dimension extends NamedItem {
  position: { x: number; y: number }
  keyParameterId: string
  parameters: Parameter[]
  hierarchies: Hierarchy[]
}

export interface Fact extends NamedItem {
  measures: NamedItem[]
}

export interface Schema {
  version: 1
  fact: Fact
  dimensions: Dimension[]
}
