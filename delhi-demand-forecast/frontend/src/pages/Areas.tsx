import { useMemo, useState } from 'react'
import AreaMap from '../components/charts/AreaMap.tsx'
import FeederHeatmap from '../components/charts/FeederHeatmap.tsx'
import FeederTable from '../components/FeederTable.tsx'
import KpiTile from '../components/ui/KpiTile.tsx'
import Panel from '../components/ui/Panel.tsx'
import { Badge, methodKind } from '../components/ui/Badges.tsx'
import { ErrorState, Loading } from '../components/ui/States.tsx'
import { useApi } from '../hooks/useApi.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { api } from '../services/api.ts'
import type { Feeder } from '../types/api.ts'
import { fmtDateTime, fmtInt } from '../utils/format.ts'

export default function Areas() {
  const { capacityMw, version, status } = useAppState()
  const [hourIdx, setHourIdx] = useState<number | null>(null)
  const feeders = useApi((s) => api.feeders({ horizon: 24, capacityMw }, s), [capacityMw, version])
  const d = feeders.data

  // Re-derive per-area rows for the selected hour from the hourly grid so the
  // slider never triggers a round-trip.
  const view = useMemo<{ ts: string; rows: Feeder[]; system: number } | null>(() => {
    if (!d) return null
    if (hourIdx == null) return { ts: d.as_of, rows: d.feeders, system: d.system_mw }
    const h = d.hourly[hourIdx]
    const rows = d.feeders.map((f) => {
      const util = h.utilization_pct[f.id] ?? 0
      const predicted = (f.capacity_mw * util) / 100
      const status = util >= 95 ? 'critical' : util >= 85 ? 'warning' : 'ok'
      return { ...f, utilization_pct: util, predicted_mw: Math.round(predicted * 10) / 10, status } as Feeder
    })
    return { ts: h.ts, rows, system: h.system_mw }
  }, [d, hourIdx])

  const worst = view ? [...view.rows].sort((a, b) => b.utilization_pct - a.utilization_pct)[0] : null
  const shares = status?.assumptions.discom_share

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Area and DISCOM risk</h1>
        <p className="text-xs text-ink-3">The system forecast split across Delhi's five distribution licensees. Real feeder telemetry is not public, so the split uses configured shares and simulated capacities.</p>
      </div>

      {feeders.loading && !d ? <Loading height="h-64" /> : feeders.error ? <ErrorState error={feeders.error} onRetry={feeders.refetch} /> : d && view && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile label="System demand" value={fmtInt(view.system)} unit="MW" sub={fmtDateTime(view.ts)} tone="accent" />
            <KpiTile label="Most loaded area" value={worst?.discom ?? '–'} sub={worst ? `${worst.utilization_pct.toFixed(1)}% of capacity` : '–'} tone={worst?.status === 'critical' ? 'critical' : worst?.status === 'warning' ? 'warning' : 'default'} />
            <KpiTile label="Areas in warning+" value={view.rows.filter((r) => r.status !== 'ok').length} unit={`of ${view.rows.length}`} />
            <KpiTile label="Basis" value={hourIdx == null ? (d.basis === 'forecast_peak' ? 'Forecast peak hour' : d.basis) : 'Selected hour'} sub={d.forecast_method === 'ml_model' ? 'model forecast' : 'heuristic forecast'} />
          </div>

          <Panel
            title="Hour selector"
            subtitle="Slide to evaluate any hour of the next 24 h. Default is the forecast peak hour."
            actions={hourIdx != null && <button onClick={() => setHourIdx(null)} className="text-[11px] text-series-blue hover:underline">Back to peak hour</button>}
          >
            <input type="range" min={0} max={d.hourly.length - 1} value={hourIdx ?? d.hourly.findIndex((h) => h.ts === d.as_of)} onChange={(e) => setHourIdx(Number(e.target.value))} className="w-full" aria-label="Hour of forecast horizon" />
            <div className="num flex justify-between text-[10px] text-ink-3"><span>{fmtDateTime(d.hourly[0].ts)}</span><span>{fmtDateTime(d.hourly[d.hourly.length - 1].ts)}</span></div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-5">
            <Panel className="xl:col-span-3" title="Areas" subtitle={`Load and utilisation at ${fmtDateTime(view.ts)}`} badges={<><Badge kind="simulated" small /><Badge kind={methodKind(d.forecast_method)} small /></>}>
              <FeederTable feeders={view.rows} />
              {shares && <p className="mt-3 text-[11px] text-ink-3">Shares: {Object.entries(shares).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' · ')} of system demand. Capacity per area = share × grid capacity × simulated headroom factor.</p>}
            </Panel>
            <Panel className="xl:col-span-2" title="Schematic map" subtitle="Positioned by area coordinates." badges={<Badge kind="simulated" small />}>
              <AreaMap feeders={view.rows} />
            </Panel>
          </div>

          <Panel title="Utilisation by area and hour" subtitle="Next 24 hours. Brighter = higher share of area capacity; rings mark warning and critical thresholds." badges={<Badge kind="simulated" small />}>
            <FeederHeatmap feeders={d.feeders} hourly={d.hourly} />
          </Panel>
        </>
      )}
    </div>
  )
}
