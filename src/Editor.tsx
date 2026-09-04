import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from './components/Canvas'
import { SidePanel } from './components/SidePanel'
import { Toolbar } from './components/Toolbar'
import type { FolderState } from './components/FolderPanel'
import { useHistorySchema } from './history'
import { deleteSelection, duplicateSelection } from './selection'
import type { Schema } from './types'
import { validateSchema } from './validate'

/**
 * One open schema: its own undo history, selection and SVG. App keeps every
 * open document mounted and hides the inactive ones, so switching tabs
 * preserves history and selection without serializing any of it.
 */
export function Editor({
  initial,
  active,
  folder,
}: {
  initial: Schema
  /** only the visible editor reacts to window-level shortcuts */
  active: boolean
  folder: FolderState
}) {
  const { schema, dispatch, commit, undo, redo, canUndo, canRedo } = useHistorySchema(initial)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [panelOpen, setPanelOpen] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)
  const warnings = useMemo(() => validateSchema(schema), [schema])

  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      // a modal owns the keyboard while it is open: without this, Delete,
      // Ctrl+D and Ctrl+Z still reach the diagram behind the dialog and
      // silently edit it
      if (document.querySelector('dialog[open]')) return
      const target = e.target as HTMLElement | null
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        !!target?.isContentEditable
      const mod = e.ctrlKey || e.metaKey

      if (mod && !isEditable && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && !isEditable && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setPanelOpen((v) => !v)
        return
      }
      if (isEditable) return

      if (mod && e.key.toLowerCase() === 'd') {
        if (selection.size === 0) return
        e.preventDefault()
        duplicateSelection(schema, selection, dispatch)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.size === 0) return
        e.preventDefault()
        const dimCount = [...selection].filter((k) => k.startsWith('dim:')).length
        if (dimCount > 0) {
          const msg =
            dimCount > 1
              ? `Supprimer ${dimCount} dimensions (et le reste de la sélection) ?`
              : 'Supprimer la dimension sélectionnée (et le reste de la sélection) ?'
          if (!window.confirm(msg)) return
        }
        deleteSelection(schema, selection, dispatch)
        setSelection(new Set())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, schema, selection, dispatch, undo, redo])

  return (
    <div className={active ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
      <Toolbar
        schema={schema}
        dispatch={dispatch}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <div className="flex min-h-0 flex-1">
        {panelOpen ? (
          <SidePanel
            schema={schema}
            dispatch={dispatch}
            warnings={warnings}
            commit={commit}
            selection={selection}
            onClose={() => setPanelOpen(false)}
            folder={folder}
          />
        ) : (
          <button
            type="button"
            title="Afficher le panneau (Ctrl+B)"
            className="flex w-6 shrink-0 items-center justify-center border-r border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => setPanelOpen(true)}
          >
            »
          </button>
        )}
        <Canvas
          schema={schema}
          dispatch={dispatch}
          svgRef={svgRef}
          selection={selection}
          setSelection={setSelection}
          commit={commit}
        />
      </div>
    </div>
  )
}
