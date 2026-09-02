import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from './components/Canvas'
import { SidePanel } from './components/SidePanel'
import { Toolbar } from './components/Toolbar'
import { useHistorySchema } from './history'
import { sampleSchema } from './sampleSchema'
import { deleteSelection, duplicateSelection } from './selection'
import { validateSchema } from './validate'

function App() {
  const { schema, dispatch, commit, undo, redo, canUndo, canRedo } = useHistorySchema(sampleSchema)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const svgRef = useRef<SVGSVGElement>(null)
  const warnings = useMemo(() => validateSchema(schema), [schema])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
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
  }, [schema, selection, dispatch, undo, redo])

  return (
    <div className="flex h-screen w-screen flex-col">
      <Toolbar
        schema={schema}
        dispatch={dispatch}
        svgRef={svgRef}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <div className="flex min-h-0 flex-1">
        <Canvas
          schema={schema}
          dispatch={dispatch}
          svgRef={svgRef}
          selection={selection}
          setSelection={setSelection}
          commit={commit}
        />
        <SidePanel schema={schema} dispatch={dispatch} warnings={warnings} commit={commit} />
      </div>
    </div>
  )
}

export default App
