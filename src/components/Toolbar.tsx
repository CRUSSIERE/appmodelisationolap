import type { Dispatch } from 'react'
import { exportJson, exportRaster, exportSvg, parseImportedJson } from '../export'
import type { Action } from '../state'
import type { Schema } from '../types'

export function Toolbar({
  schema,
  dispatch,
  svgRef,
}: {
  schema: Schema
  dispatch: Dispatch<Action>
  svgRef: React.RefObject<SVGSVGElement | null>
}) {
  function onImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    file.text().then((text) => {
      try {
        const schema = parseImportedJson(text)
        dispatch({ type: 'IMPORT_SCHEMA', schema })
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'Import invalide')
      }
    })
  }

  function onExportImage(format: 'svg' | 'png' | 'jpeg') {
    const svg = svgRef.current
    if (!svg) return
    if (format === 'svg') {
      exportSvg(svg)
    } else {
      exportRaster(svg, format).catch((err) =>
        window.alert(err instanceof Error ? err.message : 'Export échoué'),
      )
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-slate-300 bg-white px-4 py-2">
      <span className="mr-2 text-sm font-semibold text-slate-800">
        Modélisation OLAP en étoile
      </span>
      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
        onClick={() =>
          dispatch({ type: 'ADD_DIMENSION', x: 120, y: 120 })
        }
      >
        + Dimension
      </button>
      <div className="mx-2 h-5 w-px bg-slate-300" />
      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
        onClick={() => exportJson(schema)}
      >
        Enregistrer (JSON)
      </button>
      <label className="cursor-pointer rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100">
        Importer (JSON)
        <input
          type="file"
          accept="application/json"
          className="hidden"
          onChange={onImportChange}
        />
      </label>
      <div className="mx-2 h-5 w-px bg-slate-300" />
      <span className="text-sm text-slate-500">Export image :</span>
      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
        onClick={() => onExportImage('svg')}
      >
        SVG
      </button>
      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
        onClick={() => onExportImage('png')}
      >
        PNG
      </button>
      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
        onClick={() => onExportImage('jpeg')}
      >
        JPG
      </button>
    </div>
  )
}
