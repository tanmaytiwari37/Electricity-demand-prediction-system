import type { ReactNode } from 'react'

interface Props {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  tone?: 'default' | 'good' | 'warning' | 'serious' | 'critical' | 'accent'
  badge?: ReactNode
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-ink',
  accent: 'text-series-blue',
  good: 'text-good',
  warning: 'text-warning',
  serious: 'text-serious',
  critical: 'text-critical',
}

/** A stat tile: the number is the chart. */
export default function KpiTile({ label, value, unit, sub, tone = 'default', badge }: Props) {
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-lg border border-line bg-surface-1 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</span>
        {badge}
      </div>
      <div className={`num mt-1 flex items-baseline gap-1 ${TONE[tone]}`}>
        <span className="text-2xl font-bold leading-tight lg:text-[26px]">{value}</span>
        {unit && <span className="text-xs font-semibold text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="mt-1 truncate text-xs text-ink-2">{sub}</div>}
    </div>
  )
}
