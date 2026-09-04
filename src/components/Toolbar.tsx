import { useState } from 'react'
import { exportJson, parseImportedJson } from '../export'
import type { SchemaDispatch } from '../state'
import type { Schema } from '../types'
import { ExportDialog } from './ExportDialog'

export function Toolbar({
  schema,
  dispatch,
  undo,
  redo,
  canUndo,
  canRedo,
}: {
  schema: Schema
  dispatch: SchemaDispatch
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}) {
  const [exportOpen, setExportOpen] = useState(false)

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

  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
      <span className="mr-1 shrink-0 text-sm font-semibold text-slate-800">
        Modélisation OLAP en étoile
      </span>

      <ToolbarGroup>
        <ToolbarButton onClick={() => dispatch({ type: 'ADD_DIMENSION', x: 120, y: 120 })}>
          + Dimension
        </ToolbarButton>
        <ToolbarButton onClick={() => dispatch({ type: 'ADD_FACT', x: 480, y: 500 })}>
          + Fait
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
          ↶ Annuler
        </ToolbarButton>
        <ToolbarButton onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Y)">
          ↷ Rétablir
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton onClick={() => exportJson(schema)}>Enregistrer (JSON)</ToolbarButton>
        <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100">
          Importer (JSON)
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={onImportChange}
          />
        </label>
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton onClick={() => setExportOpen(true)}>Export image…</ToolbarButton>
      </ToolbarGroup>

      {exportOpen && <ExportDialog schema={schema} onClose={() => setExportOpen(false)} />}
    </div>
  )
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3 first:border-l-0 first:pl-0">
      {children}
    </div>
  )
}

function ToolbarButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  )
}
