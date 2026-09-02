import type { Schema } from './types'

export interface Warning {
  dimId: string
  message: string
}

/** Permissive checks — surfaced as warnings, never block editing. */
export function validateSchema(schema: Schema): Warning[] {
  const warnings: Warning[] = []

  for (const dim of schema.dimensions) {
    if (!dim.parameters.some((p) => p.id === dim.keyParameterId)) {
      warnings.push({
        dimId: dim.id,
        message: `${dim.name} : aucun paramètre identifiant (clé) trouvé`,
      })
    }

    for (const h of dim.hierarchies) {
      if (h.path[0] !== dim.keyParameterId) {
        warnings.push({
          dimId: dim.id,
          message: `${dim.name} / ${h.name} : la hiérarchie ne démarre pas par la clé de la dimension`,
        })
      }
    }

    const hasAnyWeakAttr = dim.parameters.some(
      (p) => p.weakAttributes.length > 0,
    )
    if (!hasAnyWeakAttr && dim.hierarchies.length === 0) {
      warnings.push({
        dimId: dim.id,
        message: `${dim.name} : aucun attribut ni hiérarchie`,
      })
    }
  }

  return warnings
}
