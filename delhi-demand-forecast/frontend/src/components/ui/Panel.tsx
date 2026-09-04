import type { ReactNode } from 'react'

interface Props {
  title?: ReactNode
  subtitle?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export default function Panel({ title, subtitle, badges, actions, children, className = '', bodyClassName = '' }: Props) {
  return (
    <section className={`rounded-lg border border-line bg-surface-1 ${className}`}>
      {(title || actions || badges) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-wide text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {badges}
            {actions}
          </div>
        </header>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </section>
  )
}
