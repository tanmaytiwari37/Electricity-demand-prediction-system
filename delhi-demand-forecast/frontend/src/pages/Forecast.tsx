import { useMemo, useState } from 'react'
import ForecastChart from '../components/charts/ForecastChart.tsx'
import TemperatureStrip from '../components/charts/TemperatureStrip.tsx'
import KpiTile, { StatStrip } from '../components/ui/KpiTile.tsx'
import Panel, { PageHeader } from '../components/ui/Panel.tsx'
import { RiskPill, SourceLine, historyKind, methodKind, weatherKind } from '../components/ui/Badges.tsx'
import { HorizonSelector } from '../components/ui/Controls.tsx'
import { ErrorState, Loading } from '../components/ui/States.tsx'
import { useApi } from '../hooks/useApi.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { api } from '../services/api.ts'
import { fmtDate, fmtDateTime, fmtDayHour, fmtInt, fmtPct, fmtTemp, riskFromUtil, riskTone } from '../utils/format.ts'

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
  const peakRisk = riskFromUtil(peakUtil, thresholds)
  const peakPoint = f?.points.find((x) => x.ts === f.peak.ts)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Demand forecast"
        subtitle="Hourly system demand with prediction interval, peak marker and capacity threshold."
        sources={f && <SourceLine kinds={[historyKind(f.data_source), methodKind(f.forecast_method), weatherKind(f.weather_source)]} />}
      >
        <HorizonSelector value={horizon} onChange={setHorizon} />
      </PageHeader>

      <StatStrip cols="md:grid-cols-4">
        <KpiTile flat label="Forecast peak" value={f ? fmtInt(f.peak.predicted_mw) : '–'} unit="MW" sub={peakPoint ? `interval ${fmtInt(peakPoint.lower_mw)} – ${fmtInt(peakPoint.upper_mw)} MW` : '–'} />
        <KpiTile flat label="Peak time" value={f ? fmtDayHour(f.peak.ts).split(' ').slice(-1)[0] : '–'} unit="IST" sub={f ? fmtDateTime(f.peak.ts) : '–'} />
        <KpiTile flat label="Peak vs capacity" value={f ? fmtPct(peakUtil) : '–'} tone={f ? riskTone(peakRisk) : 'default'} sub={f ? <RiskPill level={peakRisk} size="sm" /> : '–'} />
        <KpiTile flat label="Temperature at peak" value={peakPoint?.temp_c != null ? peakPoint.temp_c.toFixed(1) : '–'} unit="°C" sub={peakPoint?.humidity != null ? `humidity ${fmtInt(peakPoint.humidity)}%` : '–'} />
      </StatStrip>

      <Panel
        title={`Next ${horizon >= 48 ? `${horizon / 24} days` : `${horizon} hours`}`}
        subtitle={f ? `Generated ${fmtDateTime(f.generated_at)} · ${f.interval_label}` : undefined}
      >
        {forecast.loading && !f ? <Loading height="h-96" /> : forecast.error ? <ErrorState error={forecast.error} onRetry={forecast.refetch} /> : f && (
          <>
            <ForecastChart forecast={f.points} actual={actual.data?.points ?? []} capacityMw={capacityMw} peakTs={f.peak.ts} originTs={f.generated_at} height={420} />
            <div className="mt-4 border-t border-line pt-4">
              <div className="label mb-1">Temperature (°C)</div>
              <TemperatureStrip rows={tempRows} />
            </div>
          </>
        )}
      </Panel>

      {f && dailyPeaks.length > 1 && (
        <Panel title="Daily peaks" subtitle="Highest forecast hour of each day, graded against the capacity assumption." bodyClassName="!px-0 !pb-0">
          <table className="num w-full text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <th className="label px-5 py-2 text-left">Day</th>
                <th className="label px-5 py-2 text-right">Peak</th>
                <th className="label px-5 py-2 text-right">Time</th>
                <th className="label px-5 py-2 text-right">Interval</th>
                <th className="label px-5 py-2 text-right">Utilization</th>
                <th className="label px-5 py-2 text-right">Temp</th>
                <th className="label px-5 py-2 text-left">Risk</th>
              </tr>
            </thead>
            <tbody>
              {dailyPeaks.map(([day, p]) => {
                const u = (p.predicted_mw / capacityMw) * 100
                return (
                  <tr key={day} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-semibold text-ink">{day}</td>
                    <td className="px-5 py-3 text-right font-semibold text-ink">{fmtInt(p.predicted_mw)} MW</td>
                    <td className="px-5 py-3 text-right text-ink-2">{fmtDayHour(p.ts).split(' ').slice(-1)[0]}</td>
                    <td className="px-5 py-3 text-right text-ink-2">{fmtInt(p.lower_mw)} – {fmtInt(p.upper_mw)}</td>
                    <td className="px-5 py-3 text-right text-ink-2">{fmtPct(u)}</td>
                    <td className="px-5 py-3 text-right text-ink-2">{fmtTemp(p.temp_c)}</td>
                    <td className="px-5 py-3"><RiskPill level={riskFromUtil(u, thresholds)} size="sm" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>
      )}

      {f && f.forecast_method === 'heuristic' && (
        <p className="text-[12px] text-ink-3">No trained model is serving yet: this forecast is a heuristic estimate with a fixed ±5 % band. It switches to model output automatically.</p>
      )}
    </div>
  )
}
