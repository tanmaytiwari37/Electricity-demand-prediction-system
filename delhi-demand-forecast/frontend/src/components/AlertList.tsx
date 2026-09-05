import { useState } from 'react'
import type { Alert } from '../types/api.ts'
import { fmtDateTime, fmtDayHour, fmtInt, fmtPct, riskMeta } from '../utils/format.ts'
import { RiskPill } from './ui/Badges.tsx'
import { IconChevron } from './ui/Icons.tsx'
import { EmptyState } from './ui/States.tsx'

interface Props {
  alerts: Alert[]
  thresholdMw?: number
  emptyHint?: string
}

/** Expandable alert rows: severity, window, predicted, headroom. Expanding
 *  reveals the explanation and the recommended action. */
export default function AlertList({ alerts, thresholdMw, emptyHint }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (!alerts.length) {
    return <EmptyState title="No capacity-risk windows in the forecast horizon" hint={emptyHint ?? 'Alerts appear when forecast demand exceeds the medium threshold of the grid-capacity assumption. Lower the capacity in the header to see the alert flow.'} />
  }
  return (
    <ul className="divide-y divide-line">
      {alerts.map((a) => {
        const m = riskMeta[a.level]
        const below = thresholdMw != null && a.predicted_mw < thresholdMw
        const open = openId === a.id
        return (
          <li key={a.id} className={below ? 'opacity-50' : ''}>
            <button onClick={() => setOpenId(open ? null : a.id)} aria-expanded={open} className="pressable flex w-full items-center gap-4 py-3.5 text-left hover:bg-surface-2/40">
              <span className="w-[92px] shrink-0"><RiskPill level={a.level} size="sm" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{a.title}</span>
                <span className="num block text-[11.5px] text-ink-3">{fmtDayHour(a.window_start)} → {fmtDayHour(a.window_end)} IST{below ? ' · below operator threshold' : ''}</span>
              </span>
              <span className="num hidden shrink-0 gap-8 text-right text-[13px] sm:flex">
                <Cell label="Predicted" value={`${fmtInt(a.predicted_mw)} MW`} />
                <Cell label="Headroom" value={`${fmtInt(a.headroom_mw)} MW`} tone={m.text} />
              </span>
              <IconChevron size={16} className={`shrink-0 text-ink-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <div className="grid gap-5 pb-5 md:grid-cols-2 md:pl-[108px]">
                <div>
                  <div className="label mb-1.5">Explanation</div>
                  <p className="text-[12.5px] leading-relaxed text-ink-2">{a.message}</p>
                  <dl className="num mt-3 grid grid-cols-3 gap-3 text-[12px]">
                    <div><dt className="label">Peak at</dt><dd className="mt-0.5 text-ink">{fmtDateTime(a.ts)}</dd></div>
                    <div><dt className="label">Capacity</dt><dd className="mt-0.5 text-ink">{fmtInt(a.capacity_mw)} MW</dd></div>
                    <div><dt className="label">Headroom</dt><dd className="mt-0.5 text-ink">{fmtPct(a.headroom_pct)}</dd></div>
                  </dl>
                </div>
                <div className="rounded-lg border border-series-blue/30 bg-series-blue/10 p-4">
                  <div className="label mb-1.5">Recommended action</div>
                  <p className="text-[12.5px] leading-relaxed text-ink">{a.recommended_action}</p>
                  <p className="mt-2 text-[11px] text-ink-3">{a.advisory} Rule-based decision support, not an operational instruction.</p>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Cell({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <span className="block min-w-[84px]">
      <span className="label block">{label}</span>
      <span className={`block font-semibold ${tone}`}>{value}</span>
    </span>
  )
}
