import { useCallback, useReducer } from 'react'
import { schemaReducer } from './state'
import type { Action } from './state'
import type { Schema } from './types'

const MAX_HISTORY = 100

interface HistoryState {
  past: Schema[]
  present: Schema
  future: Schema[]
  /** coalesce key of the last applied action; a matching next dispatch merges
   * into the same undo step instead of pushing a new one (drags, typing) */
  lastCoalesceKey: string | null
}

type HistoryAction =
  | { type: 'APPLY'; action: Action; coalesceKey?: string }
  | { type: 'COMMIT' }
  | { type: 'UNDO' }
  | { type: 'REDO' }

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'APPLY': {
      const present = schemaReducer(state.present, action.action)
      if (action.coalesceKey && action.coalesceKey === state.lastCoalesceKey) {
        return { ...state, present, future: [] }
      }
      return {
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        present,
        future: [],
        lastCoalesceKey: action.coalesceKey ?? null,
      }
    }
    case 'COMMIT':
      return state.lastCoalesceKey === null ? state : { ...state, lastCoalesceKey: null }
    case 'UNDO': {
      if (state.past.length === 0) return state
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
        lastCoalesceKey: null,
      }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
        lastCoalesceKey: null,
      }
    }
  }
}

/** schema editing with undo/redo history. Dispatches carrying the same
 * `coalesceKey` back-to-back merge into one undo step (a whole drag, a
 * whole typing session); call `commit()` at the end of a gesture (pointerup,
 * blur) so the next one starts its own step even if the key repeats. */
export function useHistorySchema(initial: Schema) {
  const [state, rawDispatch] = useReducer(historyReducer, {
    past: [],
    present: initial,
    future: [],
    lastCoalesceKey: null,
  })

  const dispatch = useCallback(
    (action: Action, coalesceKey?: string) => rawDispatch({ type: 'APPLY', action, coalesceKey }),
    [],
  )
  const commit = useCallback(() => rawDispatch({ type: 'COMMIT' }), [])
  const undo = useCallback(() => rawDispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => rawDispatch({ type: 'REDO' }), [])

  return {
    schema: state.present,
    dispatch,
    commit,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
