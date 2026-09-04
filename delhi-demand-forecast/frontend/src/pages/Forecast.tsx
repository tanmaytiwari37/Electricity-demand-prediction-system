import { useMemo, useState } from 'react'
import ForecastChart from '../components/charts/ForecastChart.tsx'
import TemperatureStrip from '../components/charts/TemperatureStrip.tsx'
import KpiTile from '../components/ui/KpiTile.tsx'
import Panel from '../components/ui/Panel.tsx'
import { Badge, RiskPill, historyKind, methodKind, weatherKind } from '../components/ui/Badges.tsx'
import { HorizonSelector } from '../components/ui/Controls.tsx'
import { ErrorState, Loading } from '../components/ui/States.tsx'
import { useApi } from '../hooks/useApi.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { api } from '../services/api.ts'
import { fmtDate, fmtDateTime, fmtDayHour, fmtInt, fmtPct, fmtTemp, riskFromUtil } from '../utils/format.ts'

export default function Forecast() {
  const { capacityMw, version, status } = useAppState()
  const [horizon, setHorizon] = useState(24)
  const forecast = useApi((s) => api.forecast(horizon, capacityMw, s), [horizon, capacityMw, version])
  const actual = useApi((s) => api.actual(horizon >= 168 ? 72 : 48, s), [horizon, version])
  const f = forecast.data

  const dailyPeaks = useMemo(() => {
    if (!f) return []
    const byDay = new Map<string, typeof f.points[number]>()
    for (const p of f.points) {
      const d = fmtDate(p.ts)
      const cur = byDay.get(d)
      if (!cur || p.predicted_mw > cur.predicted_mw) byDay.set(d, p)
    }
    return [...byDay.entries()]
  }, [f])

  const tempRows = useMemo(() => [...(actual.data?.points ?? []).map((p) => ({ ts: p.ts, temp: p.temp_c })), ...(f?.points ?? []).map((p) => ({ ts: p.ts, temp: p.temp_c }))], [actual.data, f])
  const peakUtil = f ? (f.peak.predicted_mw / capacityMw) * 100 : 0
  const thresholds = status?.assumptions.risk_thresholds_pct

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Demand forecast</h1>
          <p className="text-xs text-ink-3">Hourly system demand with prediction band, peak marker and capacity line. Change the horizon to see the week ahead.</p>
        </div>
        <HorizonSelector value={horizon} onChange={setHorizon} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Peak demand" value={f ? fmtInt(f.peak.predicted_mw) : '–'} unit="MW" sub={f ? fmtDateTime(f.peak.ts) : '–'} tone="accent" />
        <KpiTile label="Peak vs capacity" value={f ? fmtPct(peakUtil) : '–'} sub={f ? <RiskPill level={riskFromUtil(peakUtil, thresholds)} size="sm" /> : '–'} />
        <KpiTile label="Lowest demand" value={f ? fmtInt(Math.min(...f.points.map((p) => p.predicted_mw))) : '–'} unit="MW" sub="trough in horizon" />
        <KpiTile label="Temperature at peak" value={(() => { const p = f?.points.find((x) => x.ts === f.peak.ts); return p?.temp_c != null ? fmtTemp(p.temp_c) : '–' })()} sub={f ? `humidity ${f.points.find((x) => x.ts === f.peak.ts)?.humidity ?? '–'}%` : '–'} />
      </div>

      <Panel
        title={`Next ${horizon >= 48 ? `${horizon / 24} days` : `${horizon} hours`}`}
        subtitle={f ? `Generated ${fmtDateTime(f.generated_at)} · ${f.model_name ? `model: ${f.model_name}` : 'heuristic estimate'}` : undefined}
        badges={f && (<><Badge kind={historyKind(f.data_source)} small /><Badge kind={methodKind(f.forecast_method)} small /><Badge kind={weatherKind(f.weather_source)} small /></>)}
      >
        {forecast.loading && !f ? <Loading height="h-80" /> : forecast.error ? <ErrorState error={forecast.error} onRetry={forecast.refetch} /> : f && (
          <>
            <ForecastChart forecast={f.points} actual={actual.data?.points ?? []} capacityMw={capacityMw} peakTs={f.peak.ts} originTs={f.generated_at} intervalLabel={f.interval_label} height={360} />
            <div className="mt-2 border-t border-line pt-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Temperature (°C) · {f.weather_source === 'live' ? 'Open-Meteo forecast' : f.weather_source === 'cache' ? 'cached Open-Meteo forecast' : 'simulated / analog weather'}</div>
              <TemperatureStrip rows={tempRows} />
            </div>
          </>
        )}
      </Panel>

      {f && dailyPeaks.length > 1 && (
        <Panel title="Daily peaks" subtitle="Highest forecast hour of each day in the horizon.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {dailyPeaks.map(([day, p]) => {
              const u = (p.predicted_mw / capacityMw) * 100
              return <KpiTile key={day} label={day} value={fmtInt(p.predicted_mw)} unit="MW" sub={<span className="flex items-center gap-1">{fmtDayHour(p.ts).split(' ').slice(-1)[0]} · <RiskPill level={riskFromUtil(u, thresholds)} size="sm" /></span>} />
            })}
          </div>
        </Panel>
      )}

      {f && f.forecast_method === 'heuristic' && (
        <p className="rounded border border-warning/40 bg-warning/10 p-3 text-xs text-ink-2">
          No trained model is serving yet, so this forecast is a heuristic estimate (same-hour average of the last seven days with a temperature adjustment) and its band is a fixed ±5 %. It is labelled as such and will switch to model output automatically.
        </p>
      )}
    </div>
  )
}
