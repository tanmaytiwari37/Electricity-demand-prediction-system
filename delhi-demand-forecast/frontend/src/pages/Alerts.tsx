import { useState } from 'react'
import AlertList from '../components/AlertList.tsx'
import KpiTile from '../components/ui/KpiTile.tsx'
import Panel from '../components/ui/Panel.tsx'
import { Badge, RiskPill, methodKind } from '../components/ui/Badges.tsx'
import { CapacityInput, HorizonSelector } from '../components/ui/Controls.tsx'
import { ErrorState, Loading } from '../components/ui/States.tsx'
import { useApi } from '../hooks/useApi.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { api } from '../services/api.ts'
import { fmtDateTime, fmtInt, fmtPct, riskMeta } from '../utils/format.ts'

export default function Alerts() {
  const { capacityMw, version } = useAppState()
  const [horizon, setHorizon] = useState(24)
  const alerts = useApi((s) => api.alerts(horizon, capacityMw, s), [horizon, capacityMw, version])
  const a = alerts.data
  const tone = a ? ({ low: 'good', medium: 'warning', high: 'serious', critical: 'critical' } as const)[a.risk_level] : 'default'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Capacity risk alerts</h1>
          <p className="text-xs text-ink-3">Risk is forecast demand relative to the grid-capacity assumption. Recommendations are system-generated decision support, not grid instructions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="md:hidden"><CapacityInput /></div>
          <HorizonSelector value={horizon} onChange={setHorizon} />
        </div>
      </div>

      {alerts.loading && !a ? <Loading height="h-48" /> : alerts.error ? <ErrorState error={alerts.error} onRetry={alerts.refetch} /> : a && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiTile label="Overall risk" value={<RiskPill level={a.risk_level} size="lg" />} sub={`next ${horizon} h`} />
            <KpiTile label="Forecast peak" value={fmtInt(a.peak_mw)} unit="MW" sub={fmtDateTime(a.peak_ts)} tone="accent" />
            <KpiTile label="Capacity" value={fmtInt(a.grid_capacity_mw)} unit="MW" badge={<Badge kind="assumption" small />} />
            <KpiTile label="Headroom" value={fmtInt(a.headroom_mw)} unit="MW" sub={fmtPct(a.headroom_pct)} tone={tone} />
            <KpiTile label="Peak utilisation" value={fmtPct(a.peak_utilization_pct)} tone={tone} />
            <KpiTile label="Hours at risk" value={a.hours_at_risk} unit="h" sub={`≥ ${a.thresholds_pct.medium}% of capacity`} />
          </div>

          <Panel title="Risk thresholds" subtitle="Utilisation bands used to grade each forecast hour. Demo assumption, editable in backend config." badges={<Badge kind="assumption" small />}>
            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              {(['low', 'medium', 'high', 'critical'] as const).map((lvl) => {
                const m = riskMeta[lvl]
                const t = a.thresholds_pct
                const range = lvl === 'low' ? `< ${t.medium}%` : lvl === 'medium' ? `${t.medium}–${t.high}%` : lvl === 'high' ? `${t.high}–${t.critical}%` : `≥ ${t.critical}%`
                return (
                  <div key={lvl} className={`rounded border p-2 ${m.border} ${m.bg}`}>
                    <RiskPill level={lvl} size="sm" />
                    <div className="num mt-1 font-semibold text-ink">{range} of capacity</div>
                    <div className="text-[11px] text-ink-3">{lvl === 'low' ? 'normal operations' : lvl === 'medium' ? 'monitor, keep reserves open' : lvl === 'high' ? 'pre-position reserve, advisories' : 'demand response, reserve activation'}</div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel title={`Alert windows (${a.alerts.length})`} subtitle="Consecutive hours at MEDIUM or above form one window; the worst hour sets the level." badges={<><Badge kind={methodKind(a.forecast_method)} small /><Badge kind="rules" small /></>}>
            <AlertList alerts={a.alerts} />
          </Panel>
        </>
      )}
    </div>
  )
}
