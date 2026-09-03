import type { Schema } from './types'

/** Blank starting point: one fact and two dimensions reduced to their key
 * parameter, so a new diagram starts from the minimal legal star schema
 * instead of an example the user has to delete first. */
export const sampleSchema: Schema = {
  version: 2,
  facts: [
    {
      id: 'fact-1',
      name: 'FAIT',
      position: { x: 480, y: 500 },
      measures: [{ id: 'm-1', name: 'mesure1' }],
      dimensionIds: ['dim-1', 'dim-2'],
    },
  ],
  dimensions: [
    {
      id: 'dim-1',
      name: 'DIMENSION1',
      position: { x: 220, y: 160 },
      keyParameterId: 'p-code1',
      parameters: [{ id: 'p-code1', name: 'codeDimension1', weakAttributes: [] }],
      hierarchies: [],
    },
    {
      id: 'dim-2',
      name: 'DIMENSION2',
      position: { x: 700, y: 160 },
      keyParameterId: 'p-code2',
      parameters: [{ id: 'p-code2', name: 'codeDimension2', weakAttributes: [] }],
      hierarchies: [],
    },
  ],
}
