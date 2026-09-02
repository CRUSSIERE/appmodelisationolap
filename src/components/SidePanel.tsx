import type { SchemaDispatch } from '../state'
import type { Dimension, Parameter, Schema } from '../types'
import type { Warning } from '../validate'

export function SidePanel({
  schema,
  dispatch,
  warnings,
  commit,
}: {
  schema: Schema
  dispatch: SchemaDispatch
  warnings: Warning[]
  commit: () => void
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
            dispatch({ type: 'RENAME_FACT', name: e.target.value }, 'fact-name')
          }
          onBlur={commit}
        />
        <div className="mt-2 space-y-1">
          {schema.fact.measures.map((m) => (
            <div key={m.id} className="flex items-center gap-1">
              <input
                className="w-full rounded border border-slate-300 px-2 py-1"
                value={m.name}
                onChange={(e) =>
                  dispatch(
                    {
                      type: 'RENAME_MEASURE',
                      measureId: m.id,
                      name: e.target.value,
                    },
                    `measure-name-${m.id}`,
                  )
                }
                onBlur={commit}
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
        <div className="space-y-3">
          {schema.dimensions.map((dim) => (
            <DimensionPanel key={dim.id} dim={dim} dispatch={dispatch} commit={commit} />
          ))}
          {schema.dimensions.length === 0 && (
            <p className="text-xs text-slate-400">Aucune dimension.</p>
          )}
        </div>
      </section>
    </aside>
  )
}

function DimensionPanel({
  dim,
  dispatch,
  commit,
}: {
  dim: Dimension
  dispatch: SchemaDispatch
  commit: () => void
}) {
  return (
    <details className="rounded border border-slate-300 open:bg-slate-50" open>
      <summary className="flex cursor-pointer list-none items-center gap-1 px-2 py-1.5">
        <input
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm font-semibold"
          value={dim.name}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            dispatch(
              {
                type: 'RENAME_DIMENSION',
                dimId: dim.id,
                name: e.target.value,
              },
              `dim-name-${dim.id}`,
            )
          }
          onBlur={commit}
        />
        <button
          type="button"
          className="px-1 text-red-600"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (window.confirm(`Supprimer la dimension ${dim.name} ?`)) {
              dispatch({ type: 'DELETE_DIMENSION', dimId: dim.id })
            }
          }}
        >
          ×
        </button>
      </summary>

      <div className="space-y-2 border-t border-slate-200 px-2 py-2">
        {dim.parameters.map((p) => (
          <ParameterPanel key={p.id} dim={dim} param={p} dispatch={dispatch} commit={commit} />
        ))}

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hiérarchies
          </h3>
          <div className="space-y-1">
            {dim.hierarchies.map((h) => (
              <div key={h.id} className="flex items-center gap-1">
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  value={h.name}
                  onChange={(e) =>
                    dispatch(
                      {
                        type: 'RENAME_HIERARCHY',
                        dimId: dim.id,
                        hierarchyId: h.id,
                        name: e.target.value,
                      },
                      `hier-name-${h.id}`,
                    )
                  }
                  onBlur={commit}
                />
                <button
                  type="button"
                  className="px-1 text-xs text-blue-600 hover:underline"
                  title="Ajouter un niveau au-dessus"
                  onClick={() =>
                    dispatch({
                      type: 'ADD_LEVEL_ABOVE',
                      dimId: dim.id,
                      hierarchyId: h.id,
                    })
                  }
                >
                  + niveau
                </button>
                <button
                  type="button"
                  className="px-1 text-red-600"
                  onClick={() =>
                    dispatch({
                      type: 'DELETE_HIERARCHY',
                      dimId: dim.id,
                      hierarchyId: h.id,
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => dispatch({ type: 'ADD_HIERARCHY', dimId: dim.id })}
            >
              + hiérarchie
            </button>
          </div>
        </div>
      </div>
    </details>
  )
}

function ParameterPanel({
  dim,
  param,
  dispatch,
  commit,
}: {
  dim: Dimension
  param: Parameter
  dispatch: SchemaDispatch
  commit: () => void
}) {
  const isKey = param.id === dim.keyParameterId
  return (
    <div className="rounded border border-slate-200 bg-white p-1.5">
      <div className="flex items-center gap-1">
        <input
          className="w-full rounded border border-slate-300 px-2 py-1 text-xs font-medium"
          value={param.name}
          onChange={(e) =>
            dispatch(
              {
                type: 'RENAME_PARAMETER',
                dimId: dim.id,
                paramId: param.id,
                name: e.target.value,
              },
              `param-name-${param.id}`,
            )
          }
          onBlur={commit}
        />
        {isKey && (
          <span className="whitespace-nowrap text-[10px] uppercase text-slate-400">
            clé
          </span>
        )}
      </div>

      <div className="mt-1 space-y-1 pl-2">
        {param.weakAttributes.map((wa) => (
          <div key={wa.id} className="flex items-center gap-1">
            <input
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
              value={wa.name}
              onChange={(e) =>
                dispatch(
                  {
                    type: 'RENAME_WEAK_ATTRIBUTE',
                    dimId: dim.id,
                    paramId: param.id,
                    weakAttrId: wa.id,
                    name: e.target.value,
                  },
                  `wa-name-${wa.id}`,
                )
              }
              onBlur={commit}
            />
            <button
              type="button"
              className="px-1 text-red-600"
              onClick={() =>
                dispatch({
                  type: 'DELETE_WEAK_ATTRIBUTE',
                  dimId: dim.id,
                  paramId: param.id,
                  weakAttrId: wa.id,
                })
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-xs text-blue-600 hover:underline"
          onClick={() =>
            dispatch({
              type: 'ADD_WEAK_ATTRIBUTE',
              dimId: dim.id,
              paramId: param.id,
            })
          }
        >
          + attribut
        </button>
      </div>
    </div>
  )
}
