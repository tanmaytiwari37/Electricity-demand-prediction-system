import type { ReactNode } from 'react'

export type Tone = 'default' | 'good' | 'warning' | 'serious' | 'critical' | 'accent' | 'muted'

interface Props {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  tone?: Tone
  badge?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  flat?: boolean
  className?: string
}

export const TONE: Record<Tone, string> = {
  default: 'text-ink',
  muted: 'text-ink-2',
  accent: 'text-series-blue',
  good: 'text-good',
  warning: 'text-warning',
  serious: 'text-serious',
  critical: 'text-critical',
}

const VALUE_SIZE = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-[30px]',
  xl: 'text-[44px]',
}

/** A stat: label, number, one short line beneath. */
export default function KpiTile({ label, value, unit, sub, tone = 'default', badge, size = 'md', flat, className = '' }: Props) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${flat ? 'px-5 py-4' : 'card rounded-lg border border-line bg-surface-1/90 px-5 py-4'} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="label truncate">{label}</span>
        {badge}
      </div>
      <div className={`num flex items-baseline gap-1.5 ${TONE[tone]}`}>
        <span className={`font-bold leading-none tracking-[-0.02em] ${VALUE_SIZE[size]}`}>{value}</span>
        {unit && <span className="text-[11px] font-semibold text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="truncate text-[11.5px] text-ink-3">{sub}</div>}
    </div>
  )
}

/** A row of stats inside one bordered strip, separated by hairlines. */
export function StatStrip({ children, cols = 'md:grid-cols-3 xl:grid-cols-6', className = '' }: { children: ReactNode; cols?: string; className?: string }) {
  return (
    <div className={`card grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-1/90 md:divide-y-0 ${cols} ${className}`}>
      {children}
    </div>
  )
}
