import type { Dispatch } from 'react'
import type { Action } from '../state'
import type { Schema } from '../types'
import type { Warning } from '../validate'

export function SidePanel({
  schema,
  dispatch,
  warnings,
}: {
  schema: Schema
  dispatch: Dispatch<Action>
  warnings: Warning[]
}) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-300 bg-white p-4 text-sm">
      {warnings.length > 0 && (
        <section>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Avertissements
          </h2>
          <ul className="space-y-1 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Fait
        </h2>
        <input
          className="w-full rounded border border-slate-300 px-2 py-1"
          value={schema.fact.name}
          onChange={(e) =>
            dispatch({ type: 'RENAME_FACT', name: e.target.value })
          }
        />
        <div className="mt-2 space-y-1">
          {schema.fact.measures.map((m) => (
            <div key={m.id} className="flex items-center gap-1">
              <input
                className="w-full rounded border border-slate-300 px-2 py-1"
                value={m.name}
                onChange={(e) =>
                  dispatch({
                    type: 'RENAME_MEASURE',
                    measureId: m.id,
                    name: e.target.value,
                  })
                }
              />
              <button
                type="button"
                className="px-1 text-red-600"
                onClick={() =>
                  dispatch({ type: 'DELETE_MEASURE', measureId: m.id })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline"
            onClick={() => dispatch({ type: 'ADD_MEASURE' })}
          >
            + mesure
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Dimensions
        </h2>
        <div className="space-y-2">
          {schema.dimensions.map((dim) => (
            <div key={dim.id} className="flex items-center gap-1">
              <input
                className="w-full rounded border border-slate-300 px-2 py-1"
                value={dim.name}
                onChange={(e) =>
                  dispatch({
                    type: 'RENAME_DIMENSION',
                    dimId: dim.id,
                    name: e.target.value,
                  })
                }
              />
              <button
                type="button"
                className="px-1 text-red-600"
                onClick={() => {
                  if (window.confirm(`Supprimer la dimension ${dim.name} ?`)) {
                    dispatch({ type: 'DELETE_DIMENSION', dimId: dim.id })
                  }
                }}
              >
                ×
              </button>
            </div>
          ))}
          {schema.dimensions.length === 0 && (
            <p className="text-xs text-slate-400">Aucune dimension.</p>
          )}
        </div>
      </section>
    </aside>
  )
}
