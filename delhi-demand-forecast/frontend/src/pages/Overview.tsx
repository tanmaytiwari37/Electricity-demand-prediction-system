import { Link } from 'react-router-dom'
import ActualChart from '../components/charts/ActualChart.tsx'
import ForecastChart from '../components/charts/ForecastChart.tsx'
import AlertList from '../components/AlertList.tsx'
import FeederTable from '../components/FeederTable.tsx'
import ScenarioPanel from '../components/ScenarioPanel.tsx'
import KpiTile from '../components/ui/KpiTile.tsx'
import Panel from '../components/ui/Panel.tsx'
import { Badge, RiskPill, historyKind, methodKind, weatherKind } from '../components/ui/Badges.tsx'
import { ErrorState, Loading } from '../components/ui/States.tsx'
import { useApi } from '../hooks/useApi.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { api } from '../services/api.ts'
import { fmtDayHour, fmtInt, fmtMW, fmtPct, fmtTemp, riskMeta } from '../utils/format.ts'

export default function Overview() {
  const { capacityMw, version, status } = useAppState()
  const forecast = useApi((s) => api.forecast(24, capacityMw, s), [capacityMw, version])
  const actual = useApi((s) => api.actual(24, s), [version])
  const alerts = useApi((s) => api.alerts(24, capacityMw, s), [capacityMw, version])
  const feeders = useApi((s) => api.feeders({ horizon: 24, capacityMw }, s), [capacityMw, version])
  const weather = useApi((s) => api.weatherImpact(s), [version])

  const f = forecast.data, a = alerts.data, act = actual.data
  const current = act?.points[act.points.length - 1]
  const peakPoint = f?.points.find((p) => p.ts === f.peak.ts)
  const tone = a ? ({ low: 'good', medium: 'warning', high: 'serious', critical: 'critical' } as const)[a.risk_level] : 'default'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Next 24 hours at a glance</h1>
          <p className="text-xs text-ink-3">How much electricity is expected, when the peak lands, how close it is to capacity, and where the risk sits.</p>
        </div>
        {f && (
          <div className="flex flex-wrap gap-1.5">
            <Badge kind={historyKind(f.data_source)} small />
            <Badge kind={methodKind(f.forecast_method)} small />
            <Badge kind={weatherKind(f.weather_source)} small />
          </div>
        )}
      </div>

      {(forecast.error || alerts.error) && <ErrorState error={(forecast.error ?? alerts.error)!} onRetry={() => { forecast.refetch(); alerts.refetch() }} />}

      {/* KPI row: the number is the chart */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Current demand" value={current ? fmtInt(current.actual_mw) : '–'} unit="MW" sub={current ? `latest actual · ${fmtDayHour(current.ts)}` : actual.loading ? 'loading…' : 'unavailable'} tone="accent" />
        <KpiTile label="Forecast peak" value={f ? fmtInt(f.peak.predicted_mw) : '–'} unit="MW" sub={f ? `at ${fmtDayHour(f.peak.ts)} IST` : '–'} />
        <KpiTile label="Grid capacity" value={fmtInt(capacityMw)} unit="MW" sub="editable in header" badge={<Badge kind="assumption" small />} />
        <KpiTile label="Headroom at peak" value={a ? fmtInt(a.headroom_mw) : '–'} unit="MW" sub={a ? `${fmtPct(a.headroom_pct)} of capacity free` : '–'} tone={tone} />
        <KpiTile label="Risk level" value={a ? <RiskPill level={a.risk_level} size="lg" /> : '–'} sub={a ? `${a.hours_at_risk} h at or above ${a.thresholds_pct.medium}%` : '–'} />
        <KpiTile label="Temperature" value={peakPoint?.temp_c != null ? fmtTemp(peakPoint.temp_c) : current?.temp_c != null ? fmtTemp(current.temp_c) : '–'} sub={peakPoint ? 'forecast at peak hour' : 'latest'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Demand forecast vs recent actuals"
          subtitle="Last 24 h actual (aqua) and next 24 h forecast (blue) with prediction band, peak marker and capacity line."
          badges={f && <Badge kind={methodKind(f.forecast_method)} small />}
          actions={<Link to="/forecast" className="text-[11px] text-series-blue hover:underline">7-day view →</Link>}
        >
          {forecast.loading && !f ? <Loading height="h-72" /> : forecast.error ? <ErrorState error={forecast.error} onRetry={forecast.refetch} compact /> : f && (
            <ForecastChart forecast={f.points} actual={act?.points ?? []} capacityMw={capacityMw} peakTs={f.peak.ts} originTs={f.generated_at} intervalLabel={f.interval_label} height={300} />
          )}
        </Panel>

        <Panel title="Capacity risk" subtitle="Forecast peak against the grid-capacity assumption." badges={<Badge kind="rules" small />} actions={<Link to="/alerts" className="text-[11px] text-series-blue hover:underline">All alerts →</Link>}>
          {alerts.loading && !a ? <Loading /> : alerts.error ? <ErrorState error={alerts.error} onRetry={alerts.refetch} compact /> : a && (
            <div className="flex flex-col gap-3">
              <div className={`rounded-lg border p-3 ${riskMeta[a.risk_level].border} ${riskMeta[a.risk_level].bg}`}>
                <div className="flex items-center justify-between"><RiskPill level={a.risk_level} size="lg" /><span className="num text-xs text-ink-2">peak {fmtPct(a.peak_utilization_pct)} of capacity</span></div>
                <p className="mt-2 text-xs text-ink-2">
                  Forecast peak <b className="text-ink">{fmtMW(a.peak_mw)}</b> at <b className="text-ink">{fmtDayHour(a.peak_ts)}</b> against <b className="text-ink">{fmtMW(a.grid_capacity_mw)}</b>, leaving <b className="text-ink">{fmtMW(a.headroom_mw)}</b> headroom.
                </p>
              </div>
              <AlertList alerts={a.alerts.slice(0, 2)} compact />
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Area risk at forecast peak" subtitle="System forecast split by DISCOM share." badges={<Badge kind="simulated" small />} actions={<Link to="/areas" className="text-[11px] text-series-blue hover:underline">Area view →</Link>}>
          {feeders.loading && !feeders.data ? <Loading /> : feeders.error ? <ErrorState error={feeders.error} onRetry={feeders.refetch} compact /> : feeders.data && <FeederTable feeders={feeders.data.feeders} compact />}
        </Panel>

        <Panel title="Predicted vs actual, last 24 h" subtitle="1-hour-ahead backtest against recorded demand." badges={act && <Badge kind={act.prediction_method.startsWith('ml') ? 'backtest' : 'heuristic'} small />}>
          {actual.loading && !act ? <Loading /> : actual.error ? <ErrorState error={actual.error} onRetry={actual.refetch} compact /> : act && <ActualChart points={act.points} height={200} />}
        </Panel>

        <Panel title="Why demand is high" subtitle="Temperature–load relationship in the loaded history." badges={weather.data && <Badge kind={historyKind(weather.data.data_source)} small />} actions={<Link to="/weather" className="text-[11px] text-series-blue hover:underline">Weather impact →</Link>}>
          {weather.loading && !weather.data ? <Loading /> : weather.error ? <ErrorState error={weather.error} onRetry={weather.refetch} compact /> : weather.data && (
            <div className="grid grid-cols-2 gap-3">
              <KpiTile label="Correlation" value={weather.data.correlation_temp_load?.toFixed(2) ?? '–'} sub="temperature vs load (Pearson r)" />
              <KpiTile label="Sensitivity" value={weather.data.sensitivity_mw_per_degc != null ? `+${fmtInt(weather.data.sensitivity_mw_per_degc)}` : '–'} unit="MW/°C" sub={`above ${weather.data.comfort_band_c[1]} °C`} />
              <p className="col-span-2 text-xs leading-relaxed text-ink-2">
                Historical analysis indicates demand rises as temperature climbs above the comfort band. That is an association in the data, not proof of causation on its own.
                {status?.history.source === 'demo' && ' The current history is simulated.'}
              </p>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="What if tomorrow is hotter, or rooftop solar grows?" subtitle="Interactive scenario against the baseline forecast." actions={<Link to="/scenario" className="text-[11px] text-series-blue hover:underline">Full simulator →</Link>}>
        <ScenarioPanel compact />
      </Panel>
    </div>
  )
}
