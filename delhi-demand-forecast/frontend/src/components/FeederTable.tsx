import type { Feeder } from '../types/api.ts'
import { feederMeta, fmtInt, fmtPct } from '../utils/format.ts'
import { StatusPill } from './ui/Badges.tsx'

const BAR = { ok: 'bg-series-blue', warning: 'bg-warning', critical: 'bg-critical' }

export default function FeederTable({ feeders, compact = false }: { feeders: Feeder[]; compact?: boolean }) {
  const sorted = [...feeders].sort((a, b) => b.utilization_pct - a.utilization_pct)
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full text-xs">
        <thead className="text-left text-[11px] uppercase tracking-wider text-ink-3">
          <tr>
            <th className="pb-2 pr-2 font-semibold">Area</th>
            {!compact && <th className="pb-2 pr-2 font-semibold">DISCOM</th>}
            <th className="pb-2 pr-2 text-right font-semibold">Predicted</th>
            {!compact && <th className="pb-2 pr-2 text-right font-semibold">Capacity</th>}
            <th className="pb-2 pr-2 font-semibold">Utilisation</th>
            <th className="pb-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="num">
          {sorted.map((f) => (
            <tr key={f.id} className="border-t border-line">
              <td className="py-2 pr-2">
                <div className="font-semibold text-ink">{compact ? f.discom : f.name}</div>
                {!compact && <div className="text-[10px] text-ink-3">{f.id} · {f.lat.toFixed(3)}, {f.lon.toFixed(3)}</div>}
              </td>
              {!compact && <td className="py-2 pr-2 text-ink-2">{f.discom} <span className="text-ink-3">({fmtPct(f.share_pct, 0)} share)</span></td>}
              <td className="py-2 pr-2 text-right font-semibold text-ink">{fmtInt(f.predicted_mw)} MW</td>
              {!compact && <td className="py-2 pr-2 text-right text-ink-2">{fmtInt(f.capacity_mw)} MW</td>}
              <td className="py-2 pr-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded bg-surface-3" role="meter" aria-valuenow={f.utilization_pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${f.name} utilisation`}>
                    <div className={`h-full rounded ${BAR[f.status]}`} style={{ width: `${Math.min(100, f.utilization_pct)}%` }} />
                  </div>
                  <span className={`w-12 text-right font-semibold ${feederMeta[f.status].text}`}>{fmtPct(f.utilization_pct)}</span>
                </div>
              </td>
              <td className="py-2"><StatusPill status={f.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
