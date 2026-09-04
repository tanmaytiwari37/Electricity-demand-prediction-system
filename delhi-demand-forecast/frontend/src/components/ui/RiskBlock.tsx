import type { AlertsResponse } from '../../types/api.ts'
import { fmtDayHour, fmtInt, fmtPct, riskMeta } from '../../utils/format.ts'

/** Peak-risk instrument: the risk word, a utilisation bar, four numbers. */
export default function RiskBlock({ a }: { a: AlertsResponse }) {
  const m = riskMeta[a.risk_level]
  const util = Math.max(0, Math.min(100, a.peak_utilization_pct))
  const t = a.thresholds_pct
  const bar = a.risk_level === 'low' ? 'bg-ink-2' : a.risk_level === 'medium' ? 'bg-warning' : a.risk_level === 'high' ? 'bg-serious' : 'bg-critical'
  return (
    <div className="flex h-full flex-col">
      <div className="label">Peak risk</div>
      <div className={`num mt-1 text-5xl font-bold leading-none tracking-[-0.03em] ${m.text}`}>{m.label}</div>

      <div className="mt-5">
        <div className="relative h-1.5 w-full overflow-hidden rounded-sm bg-surface-3" role="meter" aria-valuenow={util} aria-valuemin={0} aria-valuemax={100} aria-label="Forecast peak as a share of grid capacity">
          <div className={`h-full rounded-sm ${bar}`} style={{ width: `${util}%` }} />
          {[t.medium, t.high, t.critical].map((p) => <span key={p} className="absolute top-0 h-full w-px bg-surface-0" style={{ left: `${p}%` }} aria-hidden />)}
        </div>
        <div className="num mt-1.5 text-[11px] text-ink-3">Peak uses <b className="text-ink">{fmtPct(a.peak_utilization_pct)}</b> of capacity · thresholds {t.medium} / {t.high} / {t.critical}%</div>
      </div>

      <dl className="num mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4">
        <Row k="Forecast peak" v={`${fmtInt(a.peak_mw)} MW`} />
        <Row k="Peak time" v={`${fmtDayHour(a.peak_ts)} IST`} />
        <Row k="Grid capacity" v={`${fmtInt(a.grid_capacity_mw)} MW`} />
        <Row k="Headroom" v={`${fmtInt(a.headroom_mw)} MW`} tone={m.text} />
      </dl>
    </div>
  )
}

function Row({ k, v, tone = 'text-ink' }: { k: string; v: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="label">{k}</dt>
      <dd className={`mt-1 truncate text-base font-semibold ${tone}`}>{v}</dd>
    </div>
  )
}
