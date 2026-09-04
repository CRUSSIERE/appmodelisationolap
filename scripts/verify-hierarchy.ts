import assert from 'node:assert/strict'
import { schemaReducer } from '../src/state.ts'
import type { Schema } from '../src/types.ts'

const empty: Schema = { version: 2, facts: [], dimensions: [] }

// a freshly created dimension holds only its key parameter and no hierarchy
const created = schemaReducer(empty, { type: 'ADD_DIMENSION', x: 0, y: 0 })
const fresh = created.dimensions[0]
assert.equal(fresh.parameters.length, 1, 'a new dimension starts with the key alone')
assert.equal(fresh.hierarchies.length, 0, 'a new dimension starts with no hierarchy')

// adding a level with no hierarchy to hang it on must still work: the reducer
// seeds the hierarchy itself (regression — this used to be a dead end where
// only weak attributes could be added)
const withLevel = schemaReducer(created, { type: 'ADD_LEVEL_ABOVE', dimId: fresh.id })
const dim = withLevel.dimensions[0]
assert.equal(dim.parameters.length, 2, 'ADD_LEVEL_ABOVE without hierarchyId adds a parameter')
assert.equal(dim.hierarchies.length, 1, 'and creates the hierarchy carrying it')
assert.equal(dim.hierarchies[0].path.length, 2, 'the hierarchy spans key -> new level')
assert.equal(dim.hierarchies[0].path[0], dim.keyParameterId, 'it starts at the key')

// a second level on the same hierarchy extends it instead of forking
const withSecond = schemaReducer(withLevel, {
  type: 'ADD_LEVEL_ABOVE',
  dimId: dim.id,
  hierarchyId: dim.hierarchies[0].id,
})
const extended = withSecond.dimensions[0]
assert.equal(extended.hierarchies.length, 1, 'targeting a hierarchy does not create another')
assert.deepStrictEqual(
  extended.hierarchies[0].path.slice(0, 2),
  dim.hierarchies[0].path,
  'the existing path is preserved',
)
assert.equal(extended.hierarchies[0].path.length, 3, 'and gains the new level')

// branching off a non-terminal parameter forks a new hierarchy sharing the prefix
const mid = extended.hierarchies[0].path[1]
const branched = schemaReducer(withSecond, {
  type: 'ADD_LEVEL_ABOVE',
  dimId: extended.id,
  fromParamId: mid,
})
const forked = branched.dimensions[0]
assert.equal(forked.hierarchies.length, 2, 'branching creates a sibling hierarchy')
const sibling = forked.hierarchies[1]
assert.deepStrictEqual(
  sibling.path.slice(0, 2),
  [forked.keyParameterId, mid],
  'the sibling reuses the prefix up to the branch point',
)
assert.equal(sibling.path.length, 3, 'and ends on the freshly created level')

// a parameter no hierarchy references yet (a duplicate) must receive its
// level above *itself*, not silently above the key
const duplicated = schemaReducer(withSecond, {
  type: 'DUPLICATE_PARAMETER',
  dimId: extended.id,
  paramId: mid,
})
const orphan = duplicated.dimensions[0].parameters.find((p) => p.name.endsWith('_copie'))!
const grown = schemaReducer(duplicated, {
  type: 'ADD_LEVEL_ABOVE',
  dimId: extended.id,
  fromParamId: orphan.id,
})
const orphanHierarchy = grown.dimensions[0].hierarchies.at(-1)!
assert.equal(orphanHierarchy.path[1], orphan.id, 'the orphan sits on the new path')
assert.equal(orphanHierarchy.path.length, 3, 'and the new level lands above it')

// an alternate hierarchy comes with its first level already attached: a
// one-parameter path would draw neither edge nor name-chip
const alternate = schemaReducer(withSecond, { type: 'ADD_HIERARCHY', dimId: extended.id })
const withAlt = alternate.dimensions[0]
assert.equal(withAlt.hierarchies.length, 2, 'ADD_HIERARCHY adds the hierarchy')
assert.equal(withAlt.parameters.length, extended.parameters.length + 1, 'and a level to carry')
assert.deepStrictEqual(
  withAlt.hierarchies[1].path.slice(0, 1),
  [withAlt.keyParameterId],
  'the alternate starts at the key',
)
assert.equal(withAlt.hierarchies[1].path.length, 2, 'and spans key -> new level')

// branching from a mid-level parameter keeps the prefix and still gets a level
const fromMid = schemaReducer(withSecond, {
  type: 'ADD_HIERARCHY',
  dimId: extended.id,
  fromParamId: mid,
}).dimensions[0]
assert.deepStrictEqual(
  fromMid.hierarchies[1].path.slice(0, 2),
  [fromMid.keyParameterId, mid],
  'the branch reuses the prefix up to its source',
)
assert.equal(fromMid.hierarchies[1].path.length, 3, 'and ends on a fresh level')

// GraphicOLAP forbids a hierarchy on a dimension with a single parameter
assert.deepStrictEqual(
  schemaReducer(created, { type: 'ADD_HIERARCHY', dimId: fresh.id }),
  created,
  'a one-parameter dimension refuses the hierarchy outright',
)

console.log('OK — a fresh dimension can grow levels, extend and branch its hierarchies')
