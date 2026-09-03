import type { TextStyle } from './types'

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
  color: '#1e293b',
}

/** bounds the size control offers and the JSON import enforces; outside it
 * the diagram either becomes unreadable or blows up the canvas bounding box */
export const FONT_SIZE_RANGE = { min: 8, max: 32 }

/** offered in the style panel; each entry is a full CSS stack so the diagram
 * still renders if the first family is missing on the viewer's machine */
export const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: 'Système', value: 'system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Times', value: '"Times New Roman", Times, serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Courier', value: '"Courier New", Courier, monospace' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
]

/**
 * Every label's size as a multiple of the schema's base font size, so one
 * setting scales the whole diagram while keeping the relative hierarchy the
 * canvas had when these were hard-coded (14/12/13/11/9 px).
 */
export const SCALE = {
  factName: 14 / 13,
  measure: 12 / 13,
  dimName: 1,
  param: 11 / 13,
  weakAttr: 11 / 13,
  chip: 9 / 13,
  cardinality: 9 / 13,
} as const

/** CSS font shorthand for a label drawn at `scale` × the base size */
export function fontOf(style: TextStyle, scale: number, weight: number = 400): string {
  return `${weight} ${style.fontSize * scale}px ${style.fontFamily}`
}

const cache = new Map<string, number>()
let ctx: CanvasRenderingContext2D | null | undefined
/** every keystroke of a rename measures a new string, so the cache would
 * otherwise grow for as long as the tab is open */
const CACHE_LIMIT = 2000

/**
 * Width of `text` in px for a CSS font shorthand (see `fontOf`). Measured on
 * a module-level 2D context, so it is synchronous and never forces a layout
 * reflow; results are cached because the canvas re-measures the same labels
 * on every render. The measured widths are baked into the SVG as attributes,
 * so PNG/JPG/SVG exports size their boxes identically.
 */
export function measureText(text: string, font: string): number {
  const key = `${font} ${text}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  if (ctx === undefined) {
    ctx =
      typeof document === 'undefined'
        ? null
        : document.createElement('canvas').getContext('2d')
  }
  let width: number
  if (ctx) {
    ctx.font = font
    width = ctx.measureText(text).width
  } else {
    // no DOM (the node verify-* scripts import layout.ts) — approximate; those
    // assertions check topology, never pixel widths
    width = text.length * 7
  }
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, width)
  return width
}
