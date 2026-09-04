import type { Alert } from '../types/api.ts'
import { fmtDateTime, fmtDayHour, fmtMW, fmtPct, riskMeta } from '../utils/format.ts'
import { Badge, RiskPill } from './ui/Badges.tsx'
import { EmptyState } from './ui/States.tsx'

export default function AlertList({ alerts, compact = false }: { alerts: Alert[]; compact?: boolean }) {
  if (!alerts.length) {
    return <EmptyState title="No capacity-risk windows in the forecast horizon" hint="Alerts appear when forecast demand exceeds 85% of the grid-capacity assumption. Lower the capacity in the header to see the alert flow." />
  }
  return (
    <ul className="flex flex-col gap-3">
      {alerts.map((a) => {
        const m = riskMeta[a.level]
        return (
          <li key={a.id} className={`rounded-lg border ${m.border} ${m.bg} p-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RiskPill level={a.level} />
                <span className="text-sm font-semibold text-ink">{a.title}</span>
              </div>
              <span className="num text-xs text-ink-2">{fmtDayHour(a.window_start)} → {fmtDayHour(a.window_end)}</span>
            </div>
            <div className="num mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Stat label="Peak in window" value={fmtMW(a.predicted_mw)} sub={fmtDateTime(a.ts)} />
              <Stat label="Capacity" value={fmtMW(a.capacity_mw)} />
              <Stat label="Headroom" value={fmtMW(a.headroom_mw)} />
              <Stat label="Headroom %" value={fmtPct(a.headroom_pct)} />
            </div>
            {!compact && <p className="mt-2 text-xs text-ink-2">{a.message}</p>}
            <div className="mt-2 rounded border border-line bg-surface-1/60 p-2">
              <div className="mb-1 flex items-center gap-2"><Badge kind="rules" small /><span className="text-[11px] text-ink-3">{a.advisory}</span></div>
              <p className="text-xs text-ink">{a.recommended_action}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-3">{label}</div>
      <div className="font-semibold text-ink">{value}</div>
      {sub && <div className="text-[10px] text-ink-3">{sub}</div>}
    </div>
  )
}
