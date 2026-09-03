import { useEffect, useMemo, useState } from 'react'
import {
  dimensionMenuItems,
  factMenuItems,
  hierarchyMenuItems,
  measureMenuItems,
  paramBaseMenuItems,
  paramHierarchyMenuItems,
  weakAttrMenuItems,
} from '../elementActions'
import { sidePanelElementId } from '../selection'
import { wouldCreateCycle } from '../state'
import type { SchemaDispatch } from '../state'
import { DEFAULT_TEXT_STYLE, FONT_FAMILIES, FONT_SIZE_RANGE } from '../textStyle'
import type {
  AttributeDataType,
  Dimension,
  Fact,
  Measure,
  Parameter,
  Schema,
  TextStyle,
} from '../types'
import type { Warning } from '../validate'
import { ContextMenu, type MenuItem, type MenuState } from './ContextMenu'
import { FolderPanel, type FolderState } from './FolderPanel'

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

/** sections that exist regardless of the schema's contents; the rest are
 * derived per fact and per dimension. "Tout replier" folds both sets. */
const FIXED_SECTIONS = ['folder', 'text-style']

/** open/closed state of the panel's collapsible sections, keyed by a stable
 * section id (`folder`, `text-style`, `fact:<id>`, `dim:<id>`, `params:<id>`,
 * `hier:<id>`) */
export interface Folds {
  isOpen: (id: string) => boolean
  setOpen: (id: string, open: boolean) => void
}

/** a <details> whose open state lives in `folds`, so "tout replier" and the
 * canvas-selection reveal can drive it. `data-section` lets that reveal walk
 * up from a focused input to every section currently hiding it. */
function Section({
  id,
  folds,
  className,
  summary,
  children,
}: {
  id: string
  folds: Folds
  className?: string
  summary: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <details
      data-section={id}
      className={className}
      open={folds.isOpen(id)}
      onToggle={(e) => folds.setOpen(id, e.currentTarget.open)}
    >
      {summary}
      {children}
    </details>
  )
}

/** the collapsible sections that must be open for a selection key's field to
 * be visible, outermost first. Mirrors the ids the Section wrappers use. */
function sectionsHiding(key: string): string[] {
  const [kind, ...rest] = key.split(':')
  switch (kind) {
    case 'fact':
      return [`fact:${rest[0]}`]
    case 'measure':
      return [`fact:${rest[0]}`]
    case 'dim':
      return [`dim:${rest[0]}`]
    case 'param':
    case 'wa':
      return [`dim:${rest[0]}`, `params:${rest[0]}`]
    case 'hier':
      return [`dim:${rest[0]}`, `hier:${rest[0]}`]
    default:
      return []
  }
}

export function SidePanel({
  schema,
  dispatch,
  warnings,
  commit,
  selection,
  onClose,
  folder,
}: {
  schema: Schema
  dispatch: SchemaDispatch
  warnings: Warning[]
  commit: () => void
  selection: Set<string>
  onClose: () => void
  folder: FolderState
}) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const folds: Folds = {
    isOpen: (id) => !collapsed.has(id),
    setOpen: (id, open) =>
      setCollapsed((prev) => {
        if (open === !prev.has(id)) return prev
        const next = new Set(prev)
        if (open) next.delete(id)
        else next.add(id)
        return next
      }),
  }

  const allSections = useMemo(
    () => [
      ...FIXED_SECTIONS,
      ...schema.facts.map((f) => `fact:${f.id}`),
      ...schema.dimensions.flatMap((d) => [`dim:${d.id}`, `params:${d.id}`, `hier:${d.id}`]),
    ],
    [schema.facts, schema.dimensions],
  )

  // reveal the most recently selected canvas element in this panel. Opening
  // the sections that hide it happens during render (React's "adjust state
  // when a prop changes" pattern), so the field is already visible by the
  // time the effect below scrolls to it.
  const [revealed, setRevealed] = useState(selection)
  if (selection !== revealed) {
    setRevealed(selection)
    const key = [...selection].at(-1)
    const sections = key ? sectionsHiding(key) : []
    if (sections.some((sec) => collapsed.has(sec))) {
      const next = new Set(collapsed)
      for (const sec of sections) next.delete(sec)
      setCollapsed(next)
    }
  }

  // scroll to and focus the revealed field, mirroring the rename shortcut's
  // focusAndSelect target ids
  useEffect(() => {
    if (selection.size === 0) return
    const id = sidePanelElementId([...selection].at(-1)!)
    if (!id) return
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(id) as HTMLInputElement | null
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [selection])

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
    <aside className="flex h-full w-80 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-200 bg-white p-4 text-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          title="Masquer le panneau (Ctrl+B)"
          className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={onClose}
        >
          «
        </button>
        <div className="ml-auto flex gap-2 text-xs">
          <button
            type="button"
            className="font-medium text-blue-600 hover:underline"
            onClick={() => setCollapsed(new Set(allSections))}
          >
            Tout replier
          </button>
          <button
            type="button"
            className="font-medium text-blue-600 hover:underline"
            onClick={() => setCollapsed(new Set())}
          >
            Tout déplier
          </button>
        </div>
      </div>

      <Section
        id="folder"
        folds={folds}
        className="rounded-lg border border-slate-200 p-2"
        summary={
          <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dossier
          </summary>
        }
      >
        <div className="mt-2">
          <FolderPanel folder={folder} />
        </div>
      </Section>

      <TextStylePanel schema={schema} dispatch={dispatch} commit={commit} folds={folds} />

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
              folds={folds}
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
              folds={folds}
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

/** one text appearance for the whole diagram; lives in the schema so it is
 * exported with it. Every control writes the full style, coalesced per field
 * so dragging a colour picker stays a single undo step. */
function TextStylePanel({
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
      summary={
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-slate-500">
          Texte
        </summary>
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
      </div>
    </Section>
  )
}

function FactPanel({
  fact,
  schema,
  dispatch,
  commit,
  openMenu,
  folds,
}: {
  fact: Fact
  schema: Schema
  dispatch: SchemaDispatch
  commit: () => void
  openMenu: (e: React.MouseEvent, items: MenuItem[]) => void
  folds: Folds
}) {
  return (
    <Section
      id={`fact:${fact.id}`}
      folds={folds}
      className="rounded-lg border border-slate-200 p-2"
      summary={
        <summary className="flex cursor-pointer list-none items-center gap-1">
          <input
            id={`fact-name-input-${fact.id}`}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 font-medium focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={fact.name}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              dispatch({ type: 'RENAME_FACT', factId: fact.id, name: e.target.value }, `fact-name-${fact.id}`)
            }
            onBlur={commit}
          />
          <Kebab
            openMenu={openMenu}
            items={factMenuItems(fact, dispatch, () => focusAndSelect(`fact-name-input-${fact.id}`))}
          />
        </summary>
      }
    >
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
    </Section>
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
  folds,
}: {
  dim: Dimension
  schema: Schema
  dispatch: SchemaDispatch
  commit: () => void
  openMenu: (e: React.MouseEvent, items: MenuItem[]) => void
  folds: Folds
}) {
  return (
    <Section
      id={`dim:${dim.id}`}
      folds={folds}
      className="rounded-lg border border-slate-200 open:bg-slate-50/60"
      summary={
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
      }
    >
      <div className="space-y-2 border-t border-slate-200 px-2 py-2">
        <Section
          id={`params:${dim.id}`}
          folds={folds}
          summary={
            <summary className="mb-1 cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-slate-500">
              Paramètres
            </summary>
          }
        >
          <div className="space-y-2">
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
          </div>
        </Section>

        <Section
          id={`hier:${dim.id}`}
          folds={folds}
          summary={
            <summary className="mb-1 cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-slate-500">
              Hiérarchies
            </summary>
          }
        >
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
                {(() => {
                  const from = h.path[h.path.length - 1]
                  const linkableParams = dim.parameters.filter(
                    (p) => !h.path.includes(p.id) && !wouldCreateCycle(dim, from, p.id),
                  )
                  if (linkableParams.length === 0) return null
                  return (
                    <select
                      className="w-20 shrink-0 rounded border border-slate-300 bg-white px-1 py-1 text-xs text-slate-600 focus:border-blue-400 focus:outline-none"
                      title="Lier un niveau existant au-dessus"
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return
                        dispatch({
                          type: 'ADD_LEVEL_ABOVE',
                          dimId: dim.id,
                          hierarchyId: h.id,
                          existingParamId: e.target.value,
                        })
                      }}
                    >
                      <option value="">Lier…</option>
                      {linkableParams.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )
                })()}
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
        </Section>
      </div>
    </Section>
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
          items={[
            ...paramBaseMenuItems(dim, param, dispatch, () =>
              focusAndSelect(`param-name-input-${param.id}`),
            ),
            ...paramHierarchyMenuItems(dim, param.id, dispatch),
          ]}
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
