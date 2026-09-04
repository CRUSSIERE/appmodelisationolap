import type { Schema } from './types'

/** what an image export draws. Dialog-local: never written into the schema
 * and never persisted, so it can't reach the saved JSON. */
export type ExportScope =
  | { kind: 'full' }
  | { kind: 'simplified' }
  | { kind: 'dimension'; dimId: string }

/**
 * Filtered copy of the schema, rendered by the export preview. Purely
 * derived — the result is drawn and rasterized, never dispatched back into
 * the editor — so `schema` is returned untouched.
 */
export function scopeSchema(schema: Schema, scope: ExportScope): Schema {
  switch (scope.kind) {
    case 'simplified':
      return {
        ...schema,
        facts: schema.facts.map((f) => ({ ...f, measures: [] })),
        // the star schema alone: each dimension keeps its box and its key
        // (the dimension code), and loses its roll-up levels and weak
        // attributes. dimensionIds survive, so the fact links still draw.
        dimensions: schema.dimensions.map((d) => ({
          ...d,
          parameters: d.parameters
            .filter((p) => p.id === d.keyParameterId)
            .map((p) => ({ ...p, weakAttributes: [] })),
          hierarchies: [],
        })),
      }
    case 'dimension': {
      const dim = schema.dimensions.find((d) => d.id === scope.dimId)
      return { ...schema, facts: [], dimensions: dim ? [dim] : [] }
    }
    case 'full':
      return schema
  }
}

/** keeps letters (accents included), digits, dot, dash; everything a
 * filesystem or a URL could choke on collapses to a single dash */
function slug(name: string): string {
  return name.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-|-$/g, '') || 'schema'
}

/** base name of the downloaded file, without extension */
export function scopeFilename(schema: Schema, scope: ExportScope): string {
  switch (scope.kind) {
    case 'simplified':
      return `${slug(schema.facts[0]?.name ?? 'schema')}-simplifie`
    case 'dimension':
      return slug(schema.dimensions.find((d) => d.id === scope.dimId)?.name ?? 'dimension')
    case 'full':
      return slug(schema.facts[0]?.name ?? 'schema')
  }
}
