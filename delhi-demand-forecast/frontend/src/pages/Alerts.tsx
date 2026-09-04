import { useMemo, useState } from 'react'
import AlertList from '../components/AlertList.tsx'
import KpiTile, { StatStrip } from '../components/ui/KpiTile.tsx'
import Panel, { PageHeader } from '../components/ui/Panel.tsx'
import { RiskPill, SourceLine, methodKind } from '../components/ui/Badges.tsx'
import { HorizonSelector } from '../components/ui/Controls.tsx'
import { ErrorState, Loading } from '../components/ui/States.tsx'
import { useApi } from '../hooks/useApi.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { api } from '../services/api.ts'
import type { RiskLevel } from '../types/api.ts'
import { fmtDateTime, fmtDayHour, fmtInt, fmtPct, riskMeta, riskTone } from '../utils/format.ts'

type Filter = 'all' | 'critical' | 'high' | 'warning' | 'info'
const FILTERS: { key: Filter; label: string; level?: RiskLevel }[] = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical', level: 'critical' },
  { key: 'high', label: 'High', level: 'high' },
  { key: 'warning', label: 'Warning', level: 'medium' },
  { key: 'info', label: 'Info' },
]

export default function Alerts() {
  const { capacityMw, version } = useAppState()
  const [horizon, setHorizon] = useState(24)
  const [filter, setFilter] = useState<Filter>('all')
  const [sensitivity, setSensitivity] = useState(90)
  const alerts = useApi((s) => api.alerts(horizon, capacityMw, s), [horizon, capacityMw, version])
  const forecast = useApi((s) => api.forecast(horizon, capacityMw, s), [horizon, capacityMw, version])
  const a = alerts.data
  const tone = a ? riskTone(a.risk_level) : 'default'

  // Operator alert setting: a watch threshold applied to the forecast on the
  // client. It never changes the capacity assumption or the system grading.
  const thresholdMw = Math.round((capacityMw * sensitivity) / 100)
  const watch = useMemo(() => {
    const above = (forecast.data?.points ?? []).filter((p) => p.predicted_mw >= thresholdMw)
    return { hours: above.length, first: above[0]?.ts ?? null }
  }, [forecast.data, thresholdMw])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: a?.alerts.length ?? 0, critical: 0, high: 0, warning: 0, info: 1 }
    for (const x of a?.alerts ?? []) {
      if (x.level === 'critical') c.critical++
      else if (x.level === 'high') c.high++
      else if (x.level === 'medium') c.warning++
    }
    return c
  }, [a])

  const visible = useMemo(() => {
    if (!a) return []
    const lvl = FILTERS.find((f) => f.key === filter)?.level
    return lvl ? a.alerts.filter((x) => x.level === lvl) : a.alerts
  }, [a, filter])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Grid alerts"
        subtitle="Forecast demand graded against the grid-capacity assumption. Recommendations are decision support, not grid instructions."
        sources={a && <SourceLine kinds={[methodKind(a.forecast_method), 'rules']} />}
      >
        <HorizonSelector value={horizon} onChange={setHorizon} />
      </PageHeader>

      {alerts.loading && !a ? <Loading height="h-48" /> : alerts.error ? <ErrorState error={alerts.error} onRetry={alerts.refetch} /> : a && (
        <>
          <StatStrip cols="md:grid-cols-5">
            <KpiTile flat label="Overall risk" value={<span className={riskMeta[a.risk_level].text}>{riskMeta[a.risk_level].label}</span>} sub={`next ${horizon} h`} />
            <KpiTile flat label="Forecast peak" value={fmtInt(a.peak_mw)} unit="MW" sub={fmtDateTime(a.peak_ts)} />
            <KpiTile flat label="Headroom" value={fmtInt(a.headroom_mw)} unit="MW" sub={`of ${fmtInt(a.grid_capacity_mw)} MW capacity`} tone={tone} />
            <KpiTile flat label="Peak utilization" value={fmtPct(a.peak_utilization_pct)} tone={tone} sub={`thresholds ${a.thresholds_pct.medium} / ${a.thresholds_pct.high} / ${a.thresholds_pct.critical}%`} />
            <KpiTile flat label="Hours at risk" value={a.hours_at_risk} unit="h" sub={`≥ ${a.thresholds_pct.medium}% of capacity`} />
          </StatStrip>

          <Panel title="Alert sensitivity" subtitle="Operator alert setting. A watch threshold on the forecast; grid capacity and system grading are unchanged.">
            <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
              <div>
                <input type="range" min={80} max={100} step={1} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} aria-label="Alert sensitivity threshold as a percentage of grid capacity" />
                <div className="num flex justify-between text-[10.5px] text-ink-3"><span>80%</span><span>90%</span><span>100%</span></div>
              </div>
              <dl className="num grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                <div><dt className="label">Threshold</dt><dd className="mt-1 text-xl font-bold text-ink">{sensitivity}%</dd></div>
                <div><dt className="label">Threshold MW</dt><dd className="mt-1 text-xl font-bold text-ink">{fmtInt(thresholdMw)}</dd></div>
                <div><dt className="label">Hours above</dt><dd className={`mt-1 text-xl font-bold ${watch.hours ? 'text-warning' : 'text-ink'}`}>{forecast.data ? watch.hours : '–'}</dd></div>
                <div><dt className="label">First crossing</dt><dd className="mt-1 text-xl font-bold text-ink">{watch.first ? fmtDayHour(watch.first).split(' ').slice(-1)[0] : 'none'}</dd></div>
              </dl>
            </div>
          </Panel>

          <Panel
            title="Alert windows"
            subtitle="Consecutive hours at MEDIUM or above form one window; the worst hour sets the level."
            actions={
              <div className="inline-flex rounded-[4px] border border-line-strong bg-surface-2 p-0.5" role="tablist">
                {FILTERS.map((f) => (
                  <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)} className={`pressable rounded-[3px] px-2.5 py-1 text-[11px] font-semibold ${filter === f.key ? 'bg-ink text-surface-0' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'}`}>
                    {f.label}<span className={`num ml-1.5 ${filter === f.key ? 'text-surface-0/70' : 'text-ink-3'}`}>{counts[f.key]}</span>
                  </button>
                ))}
              </div>
            }
          >
            {filter === 'info' ? (
              <div className="py-2">
                <div className="flex flex-wrap items-center gap-3"><RiskPill level="low" size="sm" /><span className="text-[13px] font-semibold text-ink">System summary · next {horizon} h</span><span className="num ml-auto text-[11px] text-ink-3">{fmtDateTime(a.generated_at)}</span></div>
                <p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-ink-2">
                  Forecast peak of <b className="text-ink">{fmtInt(a.peak_mw)} MW</b> at <b className="text-ink">{fmtDayHour(a.peak_ts)} IST</b> against a grid capacity of <b className="text-ink">{fmtInt(a.grid_capacity_mw)} MW</b>, leaving <b className="text-ink">{fmtInt(a.headroom_mw)} MW</b> headroom. Overall risk <b className={riskMeta[a.risk_level].text}>{riskMeta[a.risk_level].label}</b>; {a.hours_at_risk} h at or above {a.thresholds_pct.medium}% of capacity.
                </p>
              </div>
            ) : (
              <AlertList alerts={visible} thresholdMw={thresholdMw} emptyHint={filter === 'all' ? undefined : `No ${filter} windows in the next ${horizon} h.`} />
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-[11px] text-ink-3">
              <span className="label">Grading</span>
              {(['low', 'medium', 'high', 'critical'] as const).map((lvl) => {
                const t = a.thresholds_pct
                const range = lvl === 'low' ? `< ${t.medium}%` : lvl === 'medium' ? `${t.medium}–${t.high}%` : lvl === 'high' ? `${t.high}–${t.critical}%` : `≥ ${t.critical}%`
                return <span key={lvl} className="num flex items-center gap-1.5"><RiskPill level={lvl} size="sm" />{range}</span>
              })}
              <span>of capacity</span>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
