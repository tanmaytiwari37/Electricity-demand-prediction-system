import type { ApiError } from '../../services/api.ts'
import Button from './Button.tsx'

export function Loading({ lines = 3, height = 'h-40' }: { lines?: number; height?: string }) {
  return (
    <div className={`flex ${height} animate-pulse flex-col justify-center gap-3`} role="status" aria-live="polite">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-2.5 rounded-sm bg-surface-3" style={{ width: `${88 - i * 18}%` }} />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function ErrorState({ error, onRetry, compact }: { error: ApiError | Error; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className={`rounded-[6px] border border-critical/40 bg-critical/5 ${compact ? 'p-3' : 'p-4'}`} role="alert">
      <p className="flex items-center gap-2 text-xs font-semibold text-critical"><span aria-hidden>■</span> Could not load data</p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{error.message}</p>
      {onRetry && (
        <Button size="sm" className="mt-3" onClick={onRetry}>Retry</Button>
      )}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-[6px] border border-dashed border-line-strong p-6 text-center">
      <p className="text-xs font-semibold text-ink-2">{title}</p>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-ink-3">{hint}</p>}
    </div>
  )
}
