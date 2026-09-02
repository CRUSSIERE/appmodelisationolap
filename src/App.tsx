import { useMemo, useRef } from 'react'
import { Canvas } from './components/Canvas'
import { SidePanel } from './components/SidePanel'
import { Toolbar } from './components/Toolbar'
import { sampleSchema } from './sampleSchema'
import { useSchema } from './state'
import { validateSchema } from './validate'

function App() {
  const [schema, dispatch] = useSchema(sampleSchema)
  const svgRef = useRef<SVGSVGElement>(null)
  const warnings = useMemo(() => validateSchema(schema), [schema])

  return (
    <div className="flex h-screen w-screen flex-col">
      <Toolbar schema={schema} dispatch={dispatch} svgRef={svgRef} />
      <div className="flex min-h-0 flex-1">
        <Canvas schema={schema} dispatch={dispatch} svgRef={svgRef} />
        <SidePanel schema={schema} dispatch={dispatch} warnings={warnings} />
      </div>
    </div>
  )
}

export default App
