import type { ReactNode } from 'react'

interface Props {
  title?: ReactNode
  subtitle?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  variant?: 'default' | 'plain' | 'raised'
}

const VARIANT = {
  default: 'border border-line bg-surface-1',
  plain: 'border border-line bg-transparent',
  raised: 'border border-line-strong bg-surface-2',
}

/** A panel is a title, an optional one-line subtitle, and content. Nothing
 *  else lives in the header except a single action. */
export default function Panel({ title, subtitle, badges, actions, children, className = '', bodyClassName = '', variant = 'default' }: Props) {
  return (
    <section className={`flex min-w-0 flex-col rounded-md ${VARIANT[variant]} ${className}`}>
      {(title || actions || badges) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-1">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {badges}
            {actions}
          </div>
        </header>
      )}
      <div className={`flex-1 px-5 pb-5 ${title ? 'pt-3' : 'pt-5'} ${bodyClassName}`}>{children}</div>
    </section>
  )
}

/** Page heading: title, one sentence, sources on the left; controls on the right. */
export function PageHeader({ title, subtitle, sources, children }: { title: ReactNode; subtitle?: ReactNode; sources?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[13px] text-ink-2">{subtitle}</p>}
        {sources && <div className="mt-2">{sources}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
