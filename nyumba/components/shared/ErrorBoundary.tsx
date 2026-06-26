'use client'
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: string
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: '' }
  }

  static getDerivedStateFromError(error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Hitilafu isiyojulikana'
    return { hasError: true, error: msg }
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-[200px] flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-md w-full text-center shadow-sm">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="font-bold text-lg text-gray-900 mb-2">Kosa Limetokea</h2>
            <p className="text-sm text-gray-500 mb-6">{this.state.error}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: '' })
                window.location.reload()
              }}
              className="bg-primary-500 text-white px-6 py-3 rounded-xl font-semibold text-sm"
            >
              🔄 Jaribu Tena
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
