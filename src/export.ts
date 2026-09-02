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

export function parseImportedJson(text: string): Schema {
  const data = JSON.parse(text)
  if (!data || typeof data !== 'object' || !data.fact || !data.dimensions) {
    throw new Error('Fichier JSON invalide : structure de schéma inattendue')
  }
  return data as Schema
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
