/** open/closed state of the side panel's collapsible sections, keyed by a
 * stable section id (`folder`, `text-style`, `fact:<id>`, `dim:<id>`,
 * `params:<id>`, `hier:<id>`) */
export interface Folds {
  isOpen: (id: string) => boolean
  setOpen: (id: string, open: boolean) => void
}

/**
 * A collapsible section whose open state lives in `folds`, so "tout replier"
 * and the canvas-selection reveal can drive it.
 *
 * Deliberately not `<details>/<summary>`: the headers here carry a rename
 * field and an actions button, and `<summary>`'s content model has no room
 * for interactive content — assistive technology announces the whole header
 * as one disclosure control and the nested field becomes hard to reach. A
 * dedicated toggle button leaves the header's own controls addressable. The
 * body stays mounted while closed so the reveal can find and focus a field
 * in a section it is about to open.
 */
export function Section({
  id,
  folds,
  className,
  header,
  children,
}: {
  id: string
  folds: Folds
  className?: string
  /** rendered next to the toggle; may contain its own inputs and buttons */
  header: React.ReactNode
  children: React.ReactNode
}) {
  const open = folds.isOpen(id)
  const bodyId = `section-body-${id}`
  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          title={open ? 'Replier' : 'Déplier'}
          className="shrink-0 rounded px-1 text-[10px] leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={() => folds.setOpen(id, !open)}
        >
          {open ? '▾' : '▸'}
        </button>
        {header}
      </div>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </div>
  )
}
