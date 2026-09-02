import { useState } from 'react'
import {
  dimensionMenuItems,
  hierarchyMenuItems,
  measureMenuItems,
  paramBaseMenuItems,
  weakAttrMenuItems,
} from '../elementActions'
import type { SchemaDispatch } from '../state'
import type { Dimension, Parameter, Schema } from '../types'
import type { Warning } from '../validate'
import { ContextMenu, type MenuItem, type MenuState } from './ContextMenu'

function focusAndSelect(id: string) {
  const el = document.getElementById(id) as HTMLInputElement | null
  el?.focus()
  el?.select()
}

/** small "⋮" button opening a ContextMenu anchored below itself */
function Kebab({ items, openMenu }: { items: MenuItem[]; openMenu: (e: React.MouseEvent, items: MenuItem[]) => void }) {
  return (
    <button
      type="button"
      title="Actions"
      className="shrink-0 rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
      onClick={(e) => openMenu(e, items)}
    >
      ⋮
    </button>
  )
}

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
  const [menu, setMenu] = useState<MenuState | null>(null)

  function openMenu(e: React.MouseEvent, items: MenuItem[]) {
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const MENU_WIDTH = 200
    setMenu({
      x: Math.min(rect.right, window.innerWidth - MENU_WIDTH - 8),
      y: rect.bottom + 4,
      items,
    })
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-slate-200 bg-white p-4 text-sm">
      {warnings.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Avertissements
          </h2>
          <ul className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Fait
        </h2>
        <input
          id="fact-name-input"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 font-medium focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          value={schema.fact.name}
          onChange={(e) =>
            dispatch({ type: 'RENAME_FACT', name: e.target.value }, 'fact-name')
          }
          onBlur={commit}
        />
        <div className="mt-2 space-y-1">
          {schema.fact.measures.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-slate-50"
            >
              <input
                id={`measure-name-input-${m.id}`}
                className="w-full rounded border border-slate-300 px-2 py-1 focus:border-blue-400 focus:outline-none"
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
              <Kebab
                openMenu={openMenu}
                items={measureMenuItems(m, dispatch, () =>
                  focusAndSelect(`measure-name-input-${m.id}`),
                )}
              />
            </div>
          ))}
          <button
            type="button"
            className="text-xs font-medium text-blue-600 hover:underline"
            onClick={() => dispatch({ type: 'ADD_MEASURE' })}
          >
            + mesure
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Dimensions
        </h2>
        <div className="space-y-3">
          {schema.dimensions.map((dim) => (
            <DimensionPanel
              key={dim.id}
              dim={dim}
              dispatch={dispatch}
              commit={commit}
              openMenu={openMenu}
            />
          ))}
          {schema.dimensions.length === 0 && (
            <p className="text-xs text-slate-400">Aucune dimension.</p>
          )}
        </div>
      </section>

      {menu && <ContextMenu state={menu} onClose={() => setMenu(null)} />}
    </aside>
  )
}

function DimensionPanel({
  dim,
  dispatch,
  commit,
  openMenu,
}: {
  dim: Dimension
  dispatch: SchemaDispatch
  commit: () => void
  openMenu: (e: React.MouseEvent, items: MenuItem[]) => void
}) {
  return (
    <details className="rounded-lg border border-slate-200 open:bg-slate-50/60" open>
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-t-lg px-2 py-2">
        <input
          id={`dim-name-input-${dim.id}`}
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm font-semibold focus:border-blue-400 focus:outline-none"
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
        <Kebab
          openMenu={openMenu}
          items={dimensionMenuItems(dim, dispatch, () =>
            focusAndSelect(`dim-name-input-${dim.id}`),
          )}
        />
      </summary>

      <div className="space-y-2 border-t border-slate-200 px-2 py-2">
        {dim.parameters.map((p) => (
          <ParameterPanel
            key={p.id}
            dim={dim}
            param={p}
            dispatch={dispatch}
            commit={commit}
            openMenu={openMenu}
          />
        ))}

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hiérarchies
          </h3>
          <div className="space-y-1">
            {dim.hierarchies.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-slate-100"
              >
                <input
                  id={`hier-name-input-${h.id}`}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
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
                  className="shrink-0 whitespace-nowrap px-1 text-xs font-medium text-blue-600 hover:underline"
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
                <Kebab
                  openMenu={openMenu}
                  items={hierarchyMenuItems(dim, h, dispatch, () =>
                    focusAndSelect(`hier-name-input-${h.id}`),
                  )}
                />
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-medium text-blue-600 hover:underline"
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
  openMenu,
}: {
  dim: Dimension
  param: Parameter
  dispatch: SchemaDispatch
  commit: () => void
  openMenu: (e: React.MouseEvent, items: MenuItem[]) => void
}) {
  const isKey = param.id === dim.keyParameterId
  return (
    <div className="rounded-md border border-slate-200 bg-white p-1.5">
      <div className="flex items-center gap-1">
        <input
          id={`param-name-input-${param.id}`}
          className="w-full rounded border border-slate-300 px-2 py-1 text-xs font-medium focus:border-blue-400 focus:outline-none"
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
          <span className="whitespace-nowrap rounded bg-slate-100 px-1 py-0.5 text-[10px] uppercase text-slate-500">
            clé
          </span>
        )}
        <Kebab
          openMenu={openMenu}
          items={paramBaseMenuItems(dim, param, dispatch, () =>
            focusAndSelect(`param-name-input-${param.id}`),
          )}
        />
      </div>

      <div className="mt-1 space-y-1 pl-2">
        {param.weakAttributes.map((wa) => (
          <div key={wa.id} className="flex items-center gap-1 rounded px-0.5 hover:bg-slate-50">
            <input
              id={`wa-name-input-${wa.id}`}
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
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
            <Kebab
              openMenu={openMenu}
              items={weakAttrMenuItems(dim, param, wa, dispatch, () =>
                focusAndSelect(`wa-name-input-${wa.id}`),
              )}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-xs font-medium text-blue-600 hover:underline"
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
