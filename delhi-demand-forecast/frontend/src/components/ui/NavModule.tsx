import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconArrow } from './Icons.tsx'

interface Props {
  to: string
  title: string
  description: string
  metric?: ReactNode
  metricLabel?: string
  icon: ReactNode
  tone?: 'default' | 'warning' | 'critical'
}

const TONE = { default: 'text-ink', warning: 'text-warning', critical: 'text-critical' }

/** Navigation gateway: a whole-card link into a detailed page. */
export default function NavModule({ to, title, description, metric, metricLabel, icon, tone = 'default' }: Props) {
  return (
    <Link to={to} className="card card-lift group flex items-center gap-4 rounded-lg border border-line bg-surface-1/90 p-5 hover:border-series-blue/40">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-series-blue/30 bg-series-blue/14 text-series-blue transition-colors group-hover:bg-series-blue group-hover:text-white">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-3">{description}</span>
      </span>
      {metric != null && (
        <span className="shrink-0 text-right">
          <span className={`num block text-xl font-bold leading-none ${TONE[tone]}`}>{metric}</span>
          {metricLabel && <span className="mt-1 block text-[10px] uppercase tracking-wider text-ink-3">{metricLabel}</span>}
        </span>
      )}
      <IconArrow size={16} className="shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-series-blue" />
    </Link>
  )
}
