import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { applyCrop, exportRaster, exportSvg } from '../export'
import { type ExportScope, scopeFilename, scopeSchema } from '../exportScope'
import type { Schema } from '../types'
import { Canvas } from './Canvas'

type Format = 'svg' | 'png' | 'jpeg'

const FORMATS: { value: Format; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPG' },
  { value: 'svg', label: 'SVG' },
]

const SCOPES: { value: ExportScope['kind']; label: string; hint: string }[] = [
  { value: 'full', label: 'Schéma complet', hint: 'tout le diagramme, tel qu’à l’écran' },
  {
    value: 'simplified',
    label: 'Schéma simplifié',
    hint: 'faits sans mesures, dimensions réduites à leur code',
  },
  { value: 'dimension', label: 'Une dimension', hint: 'la dimension seule, hiérarchies comprises' },
]

/** The preview renders the real Canvas, so what the user sees is the very
 * element that gets serialized — there is no second renderer to drift. */
const DIALOG_CSS = `
/* strip the native dialog's own box so the panel inside is the whole visual */
dialog.export-dialog { padding: 0; border: 0; background: transparent; max-width: 100vw; max-height: 100vh; }
dialog.export-dialog::backdrop { background: rgb(15 23 42 / 0.4); }
.export-preview [data-export="chrome"] { display: none; }
/* Canvas's own scroll container, turned into a centering box */
.export-preview > div { display: flex; }
.export-preview svg { max-width: 100%; max-height: 100%; width: auto; height: auto; margin: auto; }
`

export function ExportDialog({ schema, onClose }: { schema: Schema; onClose: () => void }) {
  const [kind, setKind] = useState<ExportScope['kind']>('full')
  const [dimId, setDimId] = useState(schema.dimensions[0]?.id ?? '')
  const [format, setFormat] = useState<Format>('png')
  const svgRef = useRef<SVGSVGElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  // Canvas needs a selection pair; the preview's is throwaway and never read
  const [selection, setSelection] = useState<Set<string>>(new Set())

  const scope: ExportScope = kind === 'dimension' ? { kind, dimId } : { kind }
  const scoped = useMemo(
    () => scopeSchema(schema, kind === 'dimension' ? { kind, dimId } : { kind }),
    [schema, kind, dimId],
  )

  // showModal is what gives the focus trap, the initial focus and the focus
  // restore on close. It has to run before the crop effect below: a dialog
  // that is not open yet is display:none, and getBBox would measure zero.
  useLayoutEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // React does not surface the dialog's `close` event, so listen natively:
  // every native close path (Escape, .close()) has to reach the parent, or
  // the element would stay mounted while the parent still thought it open
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.addEventListener('close', onClose)
    return () => dialog.removeEventListener('close', onClose)
  }, [onClose])

  // after every render of the scoped diagram: React has just rewritten the
  // viewBox from Canvas's own bounds, so re-apply the crop on top of it
  useLayoutEffect(() => {
    if (svgRef.current) applyCrop(svgRef.current)
  }, [scoped])

  const empty = scoped.facts.length === 0 && scoped.dimensions.length === 0

  /** close() first, then unmount: the browser only hands focus back to
   * whatever opened the dialog when it is actually closed, so tearing the
   * element down on its own would drop the caller's place in the page */
  function dismiss() {
    dialogRef.current?.close()
    onClose()
  }

  function onExport() {
    const svg = svgRef.current
    if (!svg) return
    const name = scopeFilename(schema, scope)
    const fail = (err: unknown) =>
      window.alert(err instanceof Error ? err.message : 'Export échoué')
    try {
      if (format === 'svg') exportSvg(svg, name)
      else exportRaster(svg, format, name).catch(fail)
      dismiss()
    } catch (err) {
      fail(err)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="export-dialog-title"
      className="export-dialog h-full max-h-[42rem] w-full max-w-5xl p-6"
      // Escape is handled explicitly rather than through the native
      // cancel -> close chain: <dialog> is what gives the focus trap, but its
      // close event is not something every engine delivers reliably
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.preventDefault()
        dismiss()
      }}
      // a click whose target is the dialog itself landed on the backdrop
      onClick={(e) => {
        if (e.target === dialogRef.current) dismiss()
      }}
    >
      <style>{DIALOG_CSS}</style>
      <div className="flex h-full w-full overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 p-4">
          <div>
            <h2 id="export-dialog-title" className="text-sm font-semibold text-slate-800">
              Export image
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              L’aperçu montre exactement l’image produite.
            </p>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Contenu
            </legend>
            {SCOPES.map((s) => (
              <label
                key={s.value}
                className="flex cursor-pointer gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                <input
                  type="radio"
                  name="export-scope"
                  className="mt-1 shrink-0"
                  checked={kind === s.value}
                  disabled={s.value === 'dimension' && schema.dimensions.length === 0}
                  onChange={() => setKind(s.value)}
                />
                <span>
                  {s.label}
                  <span className="block text-xs text-slate-400">{s.hint}</span>
                </span>
              </label>
            ))}
            {kind === 'dimension' && (
              <select
                className="ml-6 mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
                value={dimId}
                onChange={(e) => setDimId(e.target.value)}
              >
                {schema.dimensions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Format
            </legend>
            <div className="flex gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={format === f.value}
                  className={`flex-1 rounded-md border px-3 py-1 text-sm ${
                    format === f.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => setFormat(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-auto flex gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              onClick={dismiss}
            >
              Annuler
            </button>
            <button
              type="button"
              className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={empty}
              onClick={onExport}
            >
              Exporter
            </button>
          </div>
        </div>

        {/* pointer-events-none turns the live Canvas into a still image: no
            drag, no context menu, no selection reaching the preview */}
        <div className="export-preview pointer-events-none flex min-w-0 flex-1 bg-slate-100 p-4">
          {empty ? (
            <p className="m-auto text-sm text-slate-400">Rien à exporter</p>
          ) : (
            <Canvas
              schema={scoped}
              dispatch={() => {}}
              svgRef={svgRef}
              selection={selection}
              setSelection={setSelection}
              commit={() => {}}
            />
          )}
        </div>
      </div>
    </dialog>
  )
}
