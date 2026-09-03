import assert from 'node:assert/strict'
import { sampleSchema } from '../src/sampleSchema.ts'

const roundTripped = JSON.parse(JSON.stringify(sampleSchema))

assert.deepStrictEqual(
  roundTripped,
  sampleSchema,
  'JSON round-trip must reproduce the schema exactly, positions included',
)

for (const dim of sampleSchema.dimensions) {
  const rtDim = roundTripped.dimensions.find((d: { id: string }) => d.id === dim.id)
  assert.equal(rtDim.position.x, dim.position.x, `${dim.name}.position.x drifted`)
  assert.equal(rtDim.position.y, dim.position.y, `${dim.name}.position.y drifted`)
}

const ids = new Set<string>()
function collectIds(schema: typeof sampleSchema) {
  for (const fact of schema.facts) {
    ids.add(fact.id)
    for (const m of fact.measures) ids.add(m.id)
  }
  for (const dim of schema.dimensions) {
    ids.add(dim.id)
    for (const p of dim.parameters) {
      assert.ok(!ids.has(p.id), `duplicate id: ${p.id}`)
      ids.add(p.id)
      for (const wa of p.weakAttributes) {
        assert.ok(!ids.has(wa.id), `duplicate id: ${wa.id}`)
        ids.add(wa.id)
      }
    }
    for (const h of dim.hierarchies) {
      assert.ok(!ids.has(h.id), `duplicate id: ${h.id}`)
      ids.add(h.id)
    }
  }
}
collectIds(sampleSchema)

console.log('OK — JSON round-trip is lossless (positions + ids verified)')
