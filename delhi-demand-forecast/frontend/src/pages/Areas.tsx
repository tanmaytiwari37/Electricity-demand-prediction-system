import { useMemo, useState } from 'react'
import AllocationNotice from '../components/AllocationNotice.tsx'
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

/** Dashed magenta frame = proportional allocation, never a measured value. */
const ALLOC_PANEL = 'border-dashed border-series-magenta/50'

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
  const allocBadge = <Badge kind="allocated" small />

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Area and DISCOM risk</h1>
        <p className="text-xs text-ink-3">
          The system-level forecast split across Delhi's five distribution licensees by configured share ratios. Our load data is system-wide only; nothing on this page is a feeder or DISCOM measurement.
        </p>
      </div>

      <AllocationNotice shares={shares} />

      {feeders.loading && !d ? <Loading height="h-64" /> : feeders.error ? <ErrorState error={feeders.error} onRetry={feeders.refetch} /> : d && view && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile label="System forecast" value={fmtInt(view.system)} unit="MW" sub={fmtDateTime(view.ts)} tone="accent" badge={<Badge kind={methodKind(d.forecast_method)} small />} />
            <KpiTile label="Most loaded area" value={worst ? `≈ ${worst.discom}` : '–'} sub={worst ? `≈ ${worst.utilization_pct.toFixed(1)}% of assumed area capacity` : '–'} tone={worst?.status === 'critical' ? 'critical' : worst?.status === 'warning' ? 'warning' : 'default'} badge={allocBadge} className={ALLOC_PANEL} />
            <KpiTile label="Areas at warning+" value={`≈ ${view.rows.filter((r) => r.status !== 'ok').length}`} unit={`of ${view.rows.length}`} sub="by allocated utilisation" badge={allocBadge} className={ALLOC_PANEL} />
            <KpiTile label="Basis" value={hourIdx == null ? (d.basis === 'forecast_peak' ? 'Forecast peak hour' : d.basis) : 'Selected hour'} sub={d.forecast_method === 'ml_model' ? 'model forecast, then allocated' : 'heuristic forecast, then allocated'} />
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
            <Panel className={`xl:col-span-3 ${ALLOC_PANEL}`} title="Areas (allocated)" subtitle={`System forecast × share at ${fmtDateTime(view.ts)}. ≈ marks every allocated value.`} badges={<>{allocBadge}<Badge kind={methodKind(d.forecast_method)} small /></>}>
              <FeederTable feeders={view.rows} />
            </Panel>
            <Panel className={`xl:col-span-2 ${ALLOC_PANEL}`} title="Schematic map (allocated)" subtitle="Positioned by area coordinates. Circle size is allocated load, not measured." badges={allocBadge}>
              <AreaMap feeders={view.rows} />
            </Panel>
          </div>

          <Panel className={ALLOC_PANEL} title="Allocated utilisation by area and hour" subtitle="Next 24 hours of the system forecast, split by share. Brighter = higher share of assumed area capacity; rings mark warning and critical thresholds." badges={allocBadge}>
            <FeederHeatmap feeders={d.feeders} hourly={d.hourly} />
          </Panel>
        </>
      )}
    </div>
  )
}
