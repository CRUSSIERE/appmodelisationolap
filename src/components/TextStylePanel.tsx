import type { SchemaDispatch } from '../state'
import { DEFAULT_TEXT_STYLE, FONT_FAMILIES, FONT_SIZE_RANGE } from '../textStyle'
import type { Schema, TextStyle } from '../types'
import { Section, type Folds } from './Section'

/**
 * One text appearance for the whole diagram. It lives in the schema so it is
 * exported with it; every control writes the full style, coalesced per field
 * so dragging the size slider stays a single undo step.
 */
export function TextStylePanel({
  schema,
  dispatch,
  commit,
  folds,
}: {
  schema: Schema
  dispatch: SchemaDispatch
  commit: () => void
  folds: Folds
}) {
  const style = schema.textStyle ?? DEFAULT_TEXT_STYLE
  const set = (patch: Partial<TextStyle>, coalesceKey: string) =>
    dispatch({ type: 'SET_TEXT_STYLE', textStyle: { ...style, ...patch } }, coalesceKey)

  return (
    <Section
      id="text-style"
      folds={folds}
      className="rounded-lg border border-slate-200 p-2"
      header={
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Affichage</h2>
      }
    >
      <div className="mt-2 space-y-2">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <span className="w-14 shrink-0">Police</span>
          <select
            className="w-full rounded border border-slate-300 bg-white px-1 py-1 text-xs focus:border-blue-400 focus:outline-none"
            value={style.fontFamily}
            onChange={(e) => set({ fontFamily: e.target.value }, 'text-style-family')}
            onBlur={commit}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-600">
          <span className="w-14 shrink-0">Taille</span>
          <input
            type="range"
            min={FONT_SIZE_RANGE.min}
            max={FONT_SIZE_RANGE.max}
            step={1}
            className="w-full"
            value={style.fontSize}
            onChange={(e) => set({ fontSize: Number(e.target.value) }, 'text-style-size')}
            onPointerUp={commit}
          />
          <span className="w-8 shrink-0 text-right tabular-nums">{style.fontSize}</span>
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-600">
          <span className="w-14 shrink-0">Couleur</span>
          <input
            type="color"
            className="h-7 w-full cursor-pointer rounded border border-slate-300 bg-white"
            value={style.color}
            onChange={(e) => set({ color: e.target.value }, 'text-style-color')}
            onBlur={commit}
          />
          <button
            type="button"
            className="shrink-0 text-[10px] font-medium text-blue-600 hover:underline"
            onClick={() => {
              dispatch({ type: 'SET_TEXT_STYLE', textStyle: DEFAULT_TEXT_STYLE })
              commit()
            }}
          >
            Défaut
          </button>
        </label>

        <label className="flex items-center gap-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
          <input
            type="checkbox"
            className="cursor-pointer"
            checked={schema.showCardinalities ?? true}
            onChange={(e) => {
              dispatch({ type: 'SET_SHOW_CARDINALITIES', show: e.target.checked })
              commit()
            }}
          />
          Afficher les cardinalités
        </label>
      </div>
    </Section>
  )
}
