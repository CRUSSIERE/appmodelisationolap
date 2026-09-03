import { useState } from 'react'
import {
  dimensionMenuItems,
  factMenuItems,
  hierarchyMenuItems,
  measureMenuItems,
  paramBaseMenuItems,
  weakAttrMenuItems,
} from '../elementActions'
import type { SchemaDispatch } from '../state'
import type { AttributeDataType, Dimension, Fact, Measure, Parameter, Schema } from '../types'
import type { Warning } from '../validate'
import { ContextMenu, type MenuItem, type MenuState } from './ContextMenu'

const DATA_TYPE_LABELS: Record<AttributeDataType, string> = {
  undefined: '—',
  text: 'Texte',
  integer: 'Entier',
  scientific: 'Scientifique',
  decimal: 'Décimal',
  date: 'Date',
  binary: 'Binaire',
}

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

/** compact data-type picker shared by parameters, weak attributes and measures */
function DataTypeSelect({
  value,
  onChange,
}: {
  value: AttributeDataType | undefined
  onChange: (dataType: AttributeDataType) => void
}) {
  return (
    <select
      title="Type de données"
      className="shrink-0 rounded border border-slate-300 bg-white px-1 py-1 text-[10px] text-slate-500 focus:border-blue-400 focus:outline-none"
      value={value ?? 'undefined'}
      onChange={(e) => onChange(e.target.value as AttributeDataType)}
    >
      {(Object.keys(DATA_TYPE_LABELS) as AttributeDataType[]).map((dt) => (
        <option key={dt} value={dt}>
          {DATA_TYPE_LABELS[dt]}
        </option>
      ))}
    </select>
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
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {schema.facts.length > 1 ? 'Faits' : 'Fait'}
          </h2>
          <button
            type="button"
            className="text-xs font-medium text-blue-600 hover:underline"
            onClick={() => dispatch({ type: 'ADD_FACT', x: 480, y: 500 })}
          >
            + fait
          </button>
        </div>
        <div className="space-y-3">
          {schema.facts.map((fact) => (
            <FactPanel
              key={fact.id}
              fact={fact}
              schema={schema}
              dispatch={dispatch}
              commit={commit}
              openMenu={openMenu}
            />
          ))}
          {schema.facts.length === 0 && <p className="text-xs text-slate-400">Aucun fait.</p>}
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
              schema={schema}
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

function FactPanel({
  fact,
  schema,
  dispatch,
  commit,
  openMenu,
}: {
  fact: Fact
  schema: Schema
  dispatch: SchemaDispatch
  commit: () => void
  openMenu: (e: React.MouseEvent, items: MenuItem[]) => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <div className="flex items-center gap-1">
        <input
          id={`fact-name-input-${fact.id}`}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 font-medium focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          value={fact.name}
          onChange={(e) =>
            dispatch({ type: 'RENAME_FACT', factId: fact.id, name: e.target.value }, `fact-name-${fact.id}`)
          }
          onBlur={commit}
        />
        <Kebab
          openMenu={openMenu}
          items={factMenuItems(fact, dispatch, () => focusAndSelect(`fact-name-input-${fact.id}`))}
        />
      </div>
      <div className="mt-2 space-y-1">
        {fact.measures.map((m) => (
          <MeasureRow key={m.id} factId={fact.id} measure={m} dispatch={dispatch} commit={commit} openMenu={openMenu} />
        ))}
        <button
          type="button"
          className="text-xs font-medium text-blue-600 hover:underline"
          onClick={() => dispatch({ type: 'ADD_MEASURE', factId: fact.id })}
        >
          + mesure
        </button>
      </div>
      {schema.facts.length > 1 && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Dimensions connectées
          </h3>
          <div className="flex flex-wrap gap-1">
            {schema.dimensions.map((dim) => {
              const connected = fact.dimensionIds.includes(dim.id)
              return (
                <button
                  key={dim.id}
                  type="button"
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                    connected
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}
                  onClick={() =>
                    dispatch({
                      type: connected ? 'DISCONNECT_FACT_DIMENSION' : 'CONNECT_FACT_DIMENSION',
                      factId: fact.id,
                      dimId: dim.id,
                    })
                  }
                >
                  {dim.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function MeasureRow({
  factId,
  measure,
  dispatch,
  commit,
  openMenu,
}: {
  factId: string
  measure: Measure
  dispatch: SchemaDispatch
  commit: () => void
  openMenu: (e: React.MouseEvent, items: MenuItem[]) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-slate-50">
      <input
        id={`measure-name-input-${measure.id}`}
        className="w-full rounded border border-slate-300 px-2 py-1 focus:border-blue-400 focus:outline-none"
        value={measure.name}
        onChange={(e) =>
          dispatch(
            { type: 'RENAME_MEASURE', factId, measureId: measure.id, name: e.target.value },
            `measure-name-${measure.id}`,
          )
        }
        onBlur={commit}
      />
      <DataTypeSelect
        value={measure.dataType}
        onChange={(dataType) => dispatch({ type: 'SET_MEASURE_DATA_TYPE', factId, measureId: measure.id, dataType })}
      />
      <Kebab
        openMenu={openMenu}
        items={measureMenuItems(factId, measure, dispatch, () => focusAndSelect(`measure-name-input-${measure.id}`))}
      />
    </div>
  )
}

function DimensionPanel({
  dim,
  schema,
  dispatch,
  commit,
  openMenu,
}: {
  dim: Dimension
  schema: Schema
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
          items={dimensionMenuItems(schema, dim, dispatch, () =>
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
              className="text-xs font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
              disabled={dim.parameters.length < 2}
              title={dim.parameters.length < 2 ? 'Nécessite au moins 2 paramètres' : undefined}
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
        <DataTypeSelect
          value={param.dataType}
          onChange={(dataType) =>
            dispatch({ type: 'SET_PARAMETER_DATA_TYPE', dimId: dim.id, paramId: param.id, dataType })
          }
        />
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
            <DataTypeSelect
              value={wa.dataType}
              onChange={(dataType) =>
                dispatch({
                  type: 'SET_WEAK_ATTRIBUTE_DATA_TYPE',
                  dimId: dim.id,
                  paramId: param.id,
                  weakAttrId: wa.id,
                  dataType,
                })
              }
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
