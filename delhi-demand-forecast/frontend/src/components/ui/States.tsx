import type { ApiError } from '../../services/api.ts'

export function Loading({ lines = 3, height = 'h-40' }: { lines?: number; height?: string }) {
  return (
    <div className={`flex ${height} animate-pulse flex-col justify-center gap-3`} role="status" aria-live="polite">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-surface-3" style={{ width: `${90 - i * 18}%` }} />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function ErrorState({ error, onRetry, compact }: { error: ApiError | Error; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className={`rounded border border-critical/40 bg-critical/10 ${compact ? 'p-3' : 'p-4'}`} role="alert">
      <p className="text-sm font-semibold text-critical">Could not load data</p>
      <p className="mt-1 text-xs text-ink-2">{error.message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded border border-line-strong bg-surface-2 px-3 py-1 text-xs font-semibold text-ink hover:bg-surface-3"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded border border-dashed border-line-strong p-6 text-center">
      <p className="text-sm font-semibold text-ink-2">{title}</p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  )
}
