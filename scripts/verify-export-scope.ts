import assert from 'node:assert/strict'
import { scopeFilename, scopeSchema } from '../src/exportScope.ts'
import type { Schema } from '../src/types.ts'

const schema: Schema = {
  version: 2,
  facts: [
    {
      id: 'f1',
      name: 'Ventes',
      position: { x: 400, y: 500 },
      measures: [
        { id: 'm1', name: 'quantite' },
        { id: 'm2', name: 'montant' },
      ],
      dimensionIds: ['d1', 'd2'],
    },
  ],
  dimensions: [
    {
      id: 'd1',
      name: 'Temps',
      position: { x: 100, y: 100 },
      keyParameterId: 'p1',
      parameters: [
        { id: 'p1', name: 'jour', weakAttributes: [{ id: 'w1', name: 'libelle' }] },
        { id: 'p2', name: 'mois', weakAttributes: [] },
      ],
      hierarchies: [{ id: 'h1', name: 'HTemps', path: ['p1', 'p2'] }],
    },
    {
      id: 'd2',
      name: 'Produit / Rayon',
      position: { x: 700, y: 100 },
      keyParameterId: 'p3',
      parameters: [{ id: 'p3', name: 'refProduit', weakAttributes: [] }],
      hierarchies: [],
    },
  ],
}

const before = structuredClone(schema)

// --- full: the schema goes through untouched -------------------------------
assert.deepEqual(scopeSchema(schema, { kind: 'full' }), schema, 'full exports the schema as is')

// --- simplified: facts without measures, dimensions down to their key ------
const simplified = scopeSchema(schema, { kind: 'simplified' })
assert.deepEqual(simplified.facts[0].measures, [], 'simplified drops the measures')
assert.equal(simplified.facts[0].name, 'Ventes', 'but keeps the fact itself')
assert.deepEqual(
  simplified.facts[0].dimensionIds,
  ['d1', 'd2'],
  'and keeps the links, so the star is still drawn',
)
const temps = simplified.dimensions[0]
assert.equal(simplified.dimensions.length, 2, 'every dimension stays')
assert.deepEqual(
  temps.parameters.map((p) => p.id),
  ['p1'],
  'a simplified dimension keeps only its key parameter',
)
assert.deepEqual(temps.parameters[0].weakAttributes, [], 'without its weak attributes')
assert.deepEqual(temps.hierarchies, [], 'and without its hierarchies')
assert.equal(temps.keyParameterId, 'p1', 'the key it points at is still present')

// --- dimension: one dimension, in full detail, no fact ---------------------
const only = scopeSchema(schema, { kind: 'dimension', dimId: 'd1' })
assert.deepEqual(only.facts, [], 'a dimension export carries no fact')
assert.equal(only.dimensions.length, 1, 'and exactly one dimension')
assert.deepEqual(
  only.dimensions[0].parameters.map((p) => p.id),
  ['p1', 'p2'],
  'that dimension keeps all its levels',
)
assert.equal(only.dimensions[0].hierarchies.length, 1, 'and its hierarchies')
assert.deepEqual(
  only.dimensions[0].parameters[0].weakAttributes.map((w) => w.id),
  ['w1'],
  'and its weak attributes',
)

// an id that no longer exists must not crash the preview
const missing = scopeSchema(schema, { kind: 'dimension', dimId: 'gone' })
assert.deepEqual(missing.dimensions, [], 'an unknown dimension id yields an empty diagram')

// --- filenames -------------------------------------------------------------
assert.equal(scopeFilename(schema, { kind: 'full' }), 'Ventes')
assert.equal(scopeFilename(schema, { kind: 'simplified' }), 'Ventes-simplifie')
assert.equal(
  scopeFilename(schema, { kind: 'dimension', dimId: 'd2' }),
  'Produit-Rayon',
  'characters a filesystem rejects collapse to a dash',
)
assert.equal(
  scopeFilename(
    { version: 2, facts: [], dimensions: [] },
    { kind: 'dimension', dimId: 'gone' },
  ),
  'dimension',
  'a missing dimension still yields a usable filename',
)
assert.equal(
  scopeFilename({ version: 2, facts: [], dimensions: [] }, { kind: 'full' }),
  'schema',
  'an unnamed schema still downloads',
)

// --- the source schema is never touched ------------------------------------
// scoping runs on the live editor schema; a mutation here would corrupt the
// open document and end up in the saved JSON
assert.deepEqual(schema, before, 'scopeSchema leaves its input untouched')

console.log('verify-export-scope: ok')
