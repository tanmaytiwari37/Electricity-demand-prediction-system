import WeatherScatter from '../components/charts/WeatherScatter.tsx'
import KpiTile from '../components/ui/KpiTile.tsx'
import Panel from '../components/ui/Panel.tsx'
import { Badge, historyKind } from '../components/ui/Badges.tsx'
import { EmptyState, ErrorState, Loading } from '../components/ui/States.tsx'
import { useApi } from '../hooks/useApi.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { api } from '../services/api.ts'
import { fmtDate, fmtInt } from '../utils/format.ts'

export default function Weather() {
  const { version, status } = useAppState()
  const weather = useApi((s) => api.weatherImpact(s), [version])
  const w = weather.data

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Weather impact</h1>
        <p className="text-xs text-ink-3">How temperature relates to system demand in the loaded history, and what the model can therefore learn from a weather forecast.</p>
      </div>

      {weather.loading && !w ? <Loading height="h-64" /> : weather.error ? <ErrorState error={weather.error} onRetry={weather.refetch} /> : w && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiTile label="Correlation (r)" value={w.correlation_temp_load?.toFixed(2) ?? '–'} sub="temperature vs hourly demand" tone="accent" />
            <KpiTile label="Sensitivity" value={w.sensitivity_mw_per_degc != null ? `+${fmtInt(w.sensitivity_mw_per_degc)}` : '–'} unit="MW / °C" sub={`OLS slope above ${w.comfort_band_c[1]} °C`} />
            <KpiTile label="Comfort band" value={`${w.comfort_band_c[0]}–${w.comfort_band_c[1]}`} unit="°C" sub="little heating or cooling load" badge={<Badge kind="assumption" small />} />
            <KpiTile label="Hours analysed" value={fmtInt(w.n_hours)} sub={w.period ? `${fmtDate(w.period.start)} → ${fmtDate(w.period.end)}` : '–'} />
          </div>

          <Panel title="Average demand by temperature" subtitle="Each dot is a 2 °C bin; dot size shows how many hours fall in the bin." badges={<Badge kind={historyKind(w.data_source)} small />}>
            {w.scatter.length ? <WeatherScatter data={w.scatter} comfort={w.comfort_band_c} /> : <EmptyState title="No temperature data in the loaded history" hint={w.note} />}
          </Panel>

          <Panel title="Reading this">
            <div className="grid gap-4 text-xs leading-relaxed text-ink-2 md:grid-cols-2">
              <p>
                <b className="text-ink">Association, not proof of causation.</b> Historical analysis indicates demand increases as temperature rises above the comfort band, and falls again in cold weather as heating load appears. Correlation alone cannot separate the direct effect of air-conditioning from things that move with temperature, such as season, daylight and holidays. The model uses temperature alongside calendar and lag features so those effects are not confused with each other.
              </p>
              <p>
                <b className="text-ink">Why it matters for operations.</b> With a sensitivity of roughly {w.sensitivity_mw_per_degc != null ? fmtInt(w.sensitivity_mw_per_degc) : '–'} MW per °C, a forecast that is 2 °C too cool can under-predict the afternoon peak by several hundred megawatts. That is the gap the what-if simulator lets you explore.
                {status?.history.source === 'demo' && <> <b className="text-warning">The current history is simulated</b>, so these statistics describe the demo generator, not Delhi.</>}
              </p>
            </div>
            {w.method && <p className="mt-3 text-[11px] text-ink-3">Method: {w.method}.</p>}
          </Panel>
        </>
      )}
    </div>
  )
}
