import WeatherScatter from '../components/charts/WeatherScatter.tsx'
import TemperatureStrip from '../components/charts/TemperatureStrip.tsx'
import KpiTile, { StatStrip } from '../components/ui/KpiTile.tsx'
import Panel, { PageHeader } from '../components/ui/Panel.tsx'
import { SourceLine, historyKind, weatherKind } from '../components/ui/Badges.tsx'
import { EmptyState, ErrorState, Loading } from '../components/ui/States.tsx'
import { useApi } from '../hooks/useApi.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { api } from '../services/api.ts'
import { fmtDate, fmtDayHour, fmtInt } from '../utils/format.ts'

export default function Weather() {
  const { version, status, capacityMw } = useAppState()
  const weather = useApi((s) => api.weatherImpact(s), [version])
  const forecast = useApi((s) => api.forecast(24, capacityMw, s), [capacityMw, version])
  const w = weather.data
  const f = forecast.data
  const now = f?.points[0]
  const hottest = f ? f.points.reduce((m, p) => ((p.temp_c ?? -Infinity) > (m.temp_c ?? -Infinity) ? p : m), f.points[0]) : null
  const strength = w?.correlation_temp_load == null ? null : Math.abs(w.correlation_temp_load) >= 0.7 ? 'strong' : Math.abs(w.correlation_temp_load) >= 0.4 ? 'moderate' : 'weak'

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Weather impact"
        subtitle="Temperature is one of the strongest observed drivers of electricity demand. This page shows the relationship in the loaded history."
        sources={<SourceLine kinds={[...(w ? [historyKind(w.data_source)] : []), ...(f ? [weatherKind(f.weather_source)] : [])]} />}
      />

      {weather.loading && !w ? <Loading height="h-28" /> : weather.error ? <ErrorState error={weather.error} onRetry={weather.refetch} /> : w && (
        <>
          <StatStrip cols="md:grid-cols-3 xl:grid-cols-6">
            <KpiTile flat label="Temperature" value={now?.temp_c != null ? now.temp_c.toFixed(1) : '–'} unit="°C" sub="now" />
            <KpiTile flat label="Humidity" value={now?.humidity != null ? fmtInt(now.humidity) : '–'} unit="%" sub="now" />
            <KpiTile flat label="Correlation (r)" value={w.correlation_temp_load?.toFixed(2) ?? '–'} sub={strength ? `${strength} association` : 'temperature vs demand'} />
            <KpiTile flat label="Sensitivity" value={w.sensitivity_mw_per_degc != null ? `+${fmtInt(w.sensitivity_mw_per_degc)}` : '–'} unit="MW / °C" sub={`above ${w.comfort_band_c[1]} °C`} />
            <KpiTile flat label="Comfort band" value={`${w.comfort_band_c[0]}–${w.comfort_band_c[1]}`} unit="°C" sub="assumed range" />
            <KpiTile flat label="Hours analysed" value={fmtInt(w.n_hours)} sub={w.period ? `${fmtDate(w.period.start)} → ${fmtDate(w.period.end)}` : '–'} />
          </StatStrip>

          <div className="grid gap-5 xl:grid-cols-3">
            <Panel className="xl:col-span-2" title="Average demand by temperature" subtitle="Each dot is a 2 °C bin; size shows hours in the bin. Grey band marks the comfort range.">
              {w.scatter.length ? <WeatherScatter data={w.scatter} comfort={w.comfort_band_c} height={360} /> : <EmptyState title="No temperature data in the loaded history" hint={w.note} />}
            </Panel>
            <Panel title="Next 24 hours" subtitle={hottest?.temp_c != null ? `Hottest ${hottest.temp_c.toFixed(1)} °C at ${fmtDayHour(hottest.ts)} · ${fmtInt(hottest.predicted_mw)} MW` : undefined} bodyClassName="flex flex-col justify-between gap-4">
              {forecast.loading && !f ? <Loading height="h-28" /> : forecast.error ? <ErrorState error={forecast.error} onRetry={forecast.refetch} compact /> : f && (
                <>
                  <div>
                    <div className="label mb-1">Temperature (°C)</div>
                    <TemperatureStrip rows={f.points.map((p) => ({ ts: p.ts, temp: p.temp_c }))} height={150} />
                  </div>
                  <p className="text-[12px] leading-relaxed text-ink-2">
                    Demand rises as temperature climbs above the comfort band. That is an association in the data, not proof of causation: the model uses temperature alongside calendar and lag features so season and daylight are not confused with heat.
                    {status?.history.source === 'demo' && <> <b className="text-warning">The current history is simulated.</b></>}
                  </p>
                </>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
