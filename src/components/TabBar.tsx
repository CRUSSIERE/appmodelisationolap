export interface Tab {
  id: string
  name: string
  /** shown on hover; tells apart same-named files from different subfolders */
  path?: string
}

export function TabBar({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
}: {
  tabs: Tab[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}) {
  return (
    <div className="flex shrink-0 items-stretch overflow-x-auto border-b border-slate-200 bg-slate-100">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <div
            key={tab.id}
            className={`flex items-center gap-1 border-r border-slate-200 pr-1 text-sm ${
              active ? 'bg-white text-slate-800' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <button
              type="button"
              className="max-w-[14rem] truncate px-3 py-1.5"
              title={tab.path ?? tab.name}
              onClick={() => onSelect(tab.id)}
            >
              {tab.name}
            </button>
            <button
              type="button"
              title="Fermer"
              className="rounded px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              onClick={() => onClose(tab.id)}
            >
              ×
            </button>
          </div>
        )
      })}
      <button
        type="button"
        title="Nouveau schéma"
        className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        onClick={onNew}
      >
        +
      </button>
    </div>
  )
}
