export interface MenuItem {
  label: string
  danger?: boolean
  onClick: () => void
}

export interface MenuState {
  x: number
  y: number
  items: MenuItem[]
}

/** generic positioned popup menu, closed by a full-screen click-catcher.
 * Used for both canvas right-click menus and side-panel kebab menus. */
export function ContextMenu({ state, onClose }: { state: MenuState; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div
        className="fixed z-50 min-w-[200px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        style={{ left: state.x, top: state.y }}
      >
        {state.items.map((item, i) => (
          <button
            key={i}
            type="button"
            className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 ${
              item.danger ? 'text-red-600' : 'text-slate-700'
            }`}
            onClick={() => {
              item.onClick()
              onClose()
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
