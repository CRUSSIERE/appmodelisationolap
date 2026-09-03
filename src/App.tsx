import { useState } from 'react'
import type { FolderEntry, FolderState } from './components/FolderPanel'
import { TabBar } from './components/TabBar'
import { Editor } from './Editor'
import { parseImportedJson } from './export'
import { makeId } from './ids'
import { sampleSchema } from './sampleSchema'
import type { Schema } from './types'

interface Doc {
  id: string
  name: string
  /** folder-relative path this was opened from; absent for unsaved documents.
   * Identity is the path, not the name: a picked folder is walked
   * recursively, so `a/schema.json` and `b/schema.json` both show up. */
  path?: string
  /** the schema the editor starts from; its live state lives in the Editor */
  initial: Schema
}

function newDoc(name: string, initial: Schema, path?: string): Doc {
  return { id: makeId('doc'), name, path, initial }
}

function App() {
  const [docs, setDocs] = useState<Doc[]>([newDoc('Nouveau schéma', sampleSchema)])
  const [activeId, setActiveId] = useState(() => docs[0].id)
  const [folderName, setFolderName] = useState<string | null>(null)
  const [entries, setEntries] = useState<FolderEntry[]>([])

  function pickFolder(files: FileList) {
    const all = [...files]
    const jsons = all
      .filter((f) => f.name.toLowerCase().endsWith('.json'))
      .map((f) => ({ name: f.name, path: f.webkitRelativePath || f.name, file: f }))
      .sort((a, b) => a.path.localeCompare(b.path))
    // webkitRelativePath is "<folder>/…"; its first segment names the folder
    setFolderName(all[0]?.webkitRelativePath?.split('/')[0] ?? null)
    setEntries(jsons)
  }

  function openEntry(entry: FolderEntry) {
    const existing = docs.find((d) => d.path === entry.path)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    entry.file
      .text()
      .then((text) => {
        const doc = newDoc(entry.name, parseImportedJson(text), entry.path)
        setDocs((prev) => [...prev, doc])
        setActiveId(doc.id)
      })
      .catch((err) =>
        window.alert(err instanceof Error ? err.message : `Lecture impossible : ${entry.name}`),
      )
  }

  function closeDoc(id: string) {
    const doc = docs.find((d) => d.id === id)
    if (!doc) return
    // closing drops the editor's undo history along with any unsaved edit,
    // and nothing here can tell an untouched tab from a modified one
    if (!window.confirm(`Fermer « ${doc.name} » ? Les modifications non enregistrées seront perdues.`)) {
      return
    }
    const remaining = docs.filter((d) => d.id !== id)
    const next = remaining.length > 0 ? remaining : [newDoc('Nouveau schéma', sampleSchema)]
    setDocs(next)
    if (id === activeId) setActiveId(next[Math.max(0, docs.indexOf(doc) - 1)]?.id ?? next[0].id)
  }

  function newTab() {
    const doc = newDoc('Nouveau schéma', sampleSchema)
    setDocs((prev) => [...prev, doc])
    setActiveId(doc.id)
  }

  const folder: FolderState = {
    name: folderName,
    entries,
    pick: pickFolder,
    open: openEntry,
  }

  return (
    <div className="flex h-screen w-screen flex-col">
      <TabBar
        tabs={docs}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={closeDoc}
        onNew={newTab}
      />
      {/* every document stays mounted so switching tabs keeps its history,
          selection and scroll position; only the active one is displayed */}
      {docs.map((doc) => (
        <Editor
          key={doc.id}
          initial={doc.initial}
          active={doc.id === activeId}
          folder={folder}
        />
      ))}
    </div>
  )
}

export default App
