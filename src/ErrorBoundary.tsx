import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur applicative interceptée :', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-slate-50 p-8 text-center">
          <p className="text-lg font-semibold text-slate-800">
            Une erreur inattendue est survenue.
          </p>
          <p className="max-w-md text-sm text-slate-600">
            {this.state.error.message} — pensez à réimporter votre dernier
            JSON exporté si le schéma en cours n’a pas été sauvegardé.
          </p>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-4 py-1.5 text-sm hover:bg-slate-100"
            onClick={() => this.setState({ error: null })}
          >
            Réessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
