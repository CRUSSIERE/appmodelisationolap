export interface FolderEntry {
  name: string
  /** path relative to the picked folder, used to disambiguate same-named files */
  path: string
  file: File
}

/** the picked folder, owned by App so every open tab shows the same listing */
export interface FolderState {
  name: string | null
  entries: FolderEntry[]
  pick: (files: FileList) => void
  open: (entry: FolderEntry) => void
}

/**
 * Directory picking uses `webkitdirectory`, which every current browser
 * supports and which works on a static host (GitHub Pages) — unlike the File
 * System Access API, it is read-only, so saving stays a download.
 */
const DIRECTORY_PROPS = {
  webkitdirectory: '',
  directory: '',
} as React.InputHTMLAttributes<HTMLInputElement>

export function FolderPanel({ folder }: { folder: FolderState }) {
  return (
    <div className="space-y-1">
      <label className="inline-block cursor-pointer rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
        {folder.name ? 'Changer de dossier' : 'Ouvrir un dossier…'}
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          {...DIRECTORY_PROPS}
          onChange={(e) => {
            if (e.target.files) folder.pick(e.target.files)
            e.target.value = ''
          }}
        />
      </label>

      {folder.name && (
        <p className="truncate text-[10px] text-slate-400" title={folder.name}>
          {folder.name}
        </p>
      )}

      {folder.name && folder.entries.length === 0 && (
        <p className="text-xs text-slate-400">Aucun fichier .json dans ce dossier.</p>
      )}

      <ul className="space-y-0.5">
        {folder.entries.map((entry) => (
          <li key={entry.path}>
            <button
              type="button"
              className="w-full truncate rounded px-1.5 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
              title={entry.path}
              onClick={() => folder.open(entry)}
            >
              {entry.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
