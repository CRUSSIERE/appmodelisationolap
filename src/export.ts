import type { Schema } from './types'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportJson(schema: Schema) {
  const blob = new Blob([JSON.stringify(schema, null, 2)], {
    type: 'application/json',
  })
  download(blob, `${schema.fact.name || 'schema'}.json`)
}

function isNamedItem(v: unknown): v is { id: string; name: string } {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as Record<string, unknown>).id === 'string' &&
    typeof (v as Record<string, unknown>).name === 'string'
  )
}

/** Structural check only — catches shapes that would otherwise crash deep in
 * rendering (e.g. `dimensions` not an array) with a message naming the
 * problem field, instead of a generic "Cannot read properties of undefined". */
function assertValidSchema(data: unknown): asserts data is Schema {
  const fail = (reason: string): never => {
    throw new Error(`Fichier JSON invalide : ${reason}`)
  }
  if (!data || typeof data !== 'object') fail('le contenu n’est pas un objet')
  const s = data as Record<string, unknown>

  if (!isNamedItem(s.fact)) fail('"fact" est manquant ou invalide')
  const fact = s.fact as Record<string, unknown>
  if (!Array.isArray(fact.measures) || !fact.measures.every(isNamedItem)) {
    fail('"fact.measures" doit être un tableau de {id, name}')
  }

  if (!Array.isArray(s.dimensions)) fail('"dimensions" doit être un tableau')
  ;(s.dimensions as unknown[]).forEach((dim, i) => {
    if (!isNamedItem(dim)) fail(`dimensions[${i}] est invalide`)
    const d = dim as Record<string, unknown>
    const pos = d.position as Record<string, unknown> | undefined
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
      fail(`dimensions[${i}].position doit être {x, y}`)
    }
    if (typeof d.keyParameterId !== 'string') {
      fail(`dimensions[${i}].keyParameterId est manquant`)
    }
    if (!Array.isArray(d.parameters)) {
      fail(`dimensions[${i}].parameters doit être un tableau`)
    }
    ;(d.parameters as unknown[]).forEach((p, j) => {
      if (!isNamedItem(p)) fail(`dimensions[${i}].parameters[${j}] est invalide`)
      const wa = (p as Record<string, unknown>).weakAttributes
      if (!Array.isArray(wa) || !wa.every(isNamedItem)) {
        fail(`dimensions[${i}].parameters[${j}].weakAttributes doit être un tableau de {id, name}`)
      }
    })
    if (!Array.isArray(d.hierarchies)) {
      fail(`dimensions[${i}].hierarchies doit être un tableau`)
    }
    ;(d.hierarchies as unknown[]).forEach((h, j) => {
      if (!isNamedItem(h)) fail(`dimensions[${i}].hierarchies[${j}] est invalide`)
      const path = (h as Record<string, unknown>).path
      if (!Array.isArray(path) || !path.every((id) => typeof id === 'string')) {
        fail(`dimensions[${i}].hierarchies[${j}].path doit être un tableau d’ids`)
      }
    })
  })
}

export function parseImportedJson(text: string): Schema {
  const data = JSON.parse(text)
  assertValidSchema(data)
  return data
}

type RasterFormat = 'png' | 'jpeg'

/** Serializes an <svg> element and rasterizes it onto a canvas at the given scale. */
export async function exportRaster(
  svg: SVGSVGElement,
  format: RasterFormat,
  scale = 2,
) {
  const width = svg.viewBox.baseVal.width || svg.clientWidth
  const height = svg.viewBox.baseVal.height || svg.clientHeight

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  if (format === 'jpeg') {
    // JPEG has no alpha channel — paint a white background first.
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bg.setAttribute('x', '0')
    bg.setAttribute('y', '0')
    bg.setAttribute('width', String(width))
    bg.setAttribute('height', String(height))
    bg.setAttribute('fill', '#ffffff')
    clone.insertBefore(bg, clone.firstChild)
  }

  const svgText = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Échec du rendu SVG'))
    img.src = svgUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D non disponible')
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, width, height)
  URL.revokeObjectURL(svgUrl)

  const mime = format === 'png' ? 'image/png' : 'image/jpeg'
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, mime, 0.95),
  )
  if (!blob) throw new Error('Échec de génération de l’image')
  download(blob, `schema.${format === 'jpeg' ? 'jpg' : 'png'}`)
}

export function exportSvg(svg: SVGSVGElement) {
  const width = svg.viewBox.baseVal.width || svg.clientWidth
  const height = svg.viewBox.baseVal.height || svg.clientHeight
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  const svgText = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
  download(blob, 'schema.svg')
}
