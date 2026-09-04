import ForecastChart from '../components/charts/ForecastChart.tsx'
import { LinkButton } from '../components/ui/Button.tsx'
import { IconAlerts, IconAreas, IconForecast, IconModel, IconScenario, IconWeather } from '../components/ui/Icons.tsx'
import NavModule from '../components/ui/NavModule.tsx'
import Panel from '../components/ui/Panel.tsx'
import RiskBlock from '../components/ui/RiskBlock.tsx'
import WeatherMark from '../components/ui/WeatherMark.tsx'
import { SourceLine, historyKind, methodKind, weatherKind } from '../components/ui/Badges.tsx'
import { ErrorState, Loading } from '../components/ui/States.tsx'
import { useApi } from '../hooks/useApi.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { api } from '../services/api.ts'
import type { ForecastPoint } from '../types/api.ts'
import { fmtDayHour, fmtInt, fmtPct, riskMeta, riskTone } from '../utils/format.ts'

/** The situation in one screen: current demand, the forecast peak and how
 *  close it sits to capacity, the weather behind it, and doors into the
 *  detailed pages. */
export default function Overview() {
  const { capacityMw, version, status } = useAppState()
  const forecast = useApi((s) => api.forecast(24, capacityMw, s), [capacityMw, version])
  const actual = useApi((s) => api.actual(24, s), [version])
  const alerts = useApi((s) => api.alerts(24, capacityMw, s), [capacityMw, version])
  const feeders = useApi((s) => api.feeders({ horizon: 24, capacityMw }, s), [capacityMw, version])
  const weather = useApi((s) => api.weatherImpact(s), [version])

  const f = forecast.data, a = alerts.data, act = actual.data, w = weather.data
  const current = act?.points[act.points.length - 1]
  const peakPoint = f?.points.find((p) => p.ts === f.peak.ts)
  const nowPoint = f?.points[0]
  const tempNow = nowPoint?.temp_c ?? current?.temp_c ?? null
  const heat = tempNow != null ? (tempNow - 10) / 35 : 0.5
  const areasAtRisk = feeders.data ? feeders.data.feeders.filter((x) => x.status !== 'ok').length : null
  const peakTime = f ? fmtDayHour(f.peak.ts) : null

  return (
    <div className="flex flex-col gap-5">
      {(forecast.error || alerts.error) && <ErrorState error={(forecast.error ?? alerts.error)!} onRetry={() => { forecast.refetch(); alerts.refetch() }} compact />}

      {/* Row 1: the headline */}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="flex flex-col justify-between gap-8 rounded-md border border-line bg-surface-1 p-6 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="label">Delhi system demand · now</div>
              <div className={`num mt-2 flex items-baseline gap-2 ${current ? 'text-ink' : 'text-ink-3'}`}>
                <span className="text-[64px] font-bold leading-none tracking-[-0.03em]">{current ? fmtInt(current.actual_mw) : '–'}</span>
                <span className="text-base font-semibold text-ink-3">MW</span>
              </div>
              <div className="mt-2 text-[12px] text-ink-3">
                {current ? `Latest recorded hour · ${fmtDayHour(current.ts)} IST` : actual.loading ? 'Loading latest actual…' : 'Latest actual unavailable'}
              </div>
            </div>
            {f && <SourceLine kinds={[historyKind(f.data_source), methodKind(f.forecast_method), weatherKind(f.weather_source)]} />}
          </div>

          {f && <HourStrip points={f.points} peakTs={f.peak.ts} capacityMw={capacityMw} />}

          <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-5 md:grid-cols-5">
            <Figure label="Forecast peak" value={f ? fmtInt(f.peak.predicted_mw) : '–'} unit="MW" />
            <Figure label="Peak time" value={peakTime ? peakTime.split(' ').slice(-1)[0] : '–'} unit="IST" sub={peakTime?.split(' ')[0]} />
            <Figure label="Grid capacity" value={fmtInt(capacityMw)} unit="MW" sub="assumption" />
            <Figure label="Headroom" value={a ? fmtInt(a.headroom_mw) : '–'} unit="MW" tone={a ? riskTone(a.risk_level) : 'default'} sub={a ? `${fmtPct(a.headroom_pct, 0)} free at peak` : undefined} />
            <Figure label="Grid risk" value={a ? riskMeta[a.risk_level].label : '–'} tone={a ? riskTone(a.risk_level) : 'default'} sub={a ? `${a.hours_at_risk} h at risk` : undefined} />
          </div>
        </div>

        <Panel title="Current conditions" bodyClassName="flex flex-col items-center justify-between gap-4">
          <WeatherMark heat={heat} size={190} />
          <div className="num grid w-full grid-cols-3 gap-2 border-t border-line pt-4 text-center">
            <Figure center label="Temperature" value={tempNow != null ? tempNow.toFixed(1) : '–'} unit="°C" sub="now" />
            <Figure center label="At peak" value={peakPoint?.temp_c != null ? peakPoint.temp_c.toFixed(1) : '–'} unit="°C" sub={peakTime?.split(' ').slice(-1)[0]} />
            <Figure center label="Humidity" value={nowPoint?.humidity != null ? fmtInt(nowPoint.humidity) : '–'} unit="%" sub="now" />
          </div>
          <p className="w-full text-center text-[11.5px] text-ink-3">
            {w?.sensitivity_mw_per_degc != null ? `About ${fmtInt(w.sensitivity_mw_per_degc)} MW more demand per °C above ${w.comfort_band_c[1]} °C in the history.` : 'Temperature is the dominant weather driver of demand.'}
          </p>
        </Panel>
      </div>

      {/* Row 2: forecast and risk */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="24-hour electricity demand forecast" subtitle="Last 24 h recorded, next 24 h predicted with interval, peak and capacity line." actions={<LinkButton to="/forecast" size="sm">Forecast</LinkButton>}>
          {forecast.loading && !f ? <Loading height="h-80" /> : forecast.error ? <ErrorState error={forecast.error} onRetry={forecast.refetch} compact /> : f && (
            <ForecastChart forecast={f.points} actual={act?.points ?? []} capacityMw={capacityMw} peakTs={f.peak.ts} originTs={f.generated_at} height={360} />
          )}
        </Panel>

        <Panel title="Capacity risk" actions={<LinkButton to="/alerts" size="sm">Alerts</LinkButton>}>
          {alerts.loading && !a ? <Loading /> : alerts.error ? <ErrorState error={alerts.error} onRetry={alerts.refetch} compact /> : a && (
            <div className="flex h-full flex-col">
              <RiskBlock a={a} />
              {feeders.data && (
                <div className="mt-5 border-t border-line pt-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="label">Areas at peak</span>
                    <span className="text-[10.5px] text-ink-3">allocated by DISCOM share, not measured</span>
                  </div>
                  <ul className="num divide-y divide-line text-[12.5px]">
                    {[...feeders.data.feeders].sort((x, y) => y.utilization_pct - x.utilization_pct).map((x) => (
                      <li key={x.id} className="flex items-center gap-3 py-1.5">
                        <span className="w-14 font-semibold text-ink">{x.discom}</span>
                        <span className="flex-1"><span className="block h-1 w-full overflow-hidden rounded-sm bg-surface-3"><span className={`block h-full ${x.status === 'ok' ? 'bg-ink-2' : x.status === 'warning' ? 'bg-warning' : 'bg-critical'}`} style={{ width: `${Math.min(100, x.utilization_pct)}%` }} /></span></span>
                        <span className={`w-11 text-right font-semibold ${x.status === 'ok' ? 'text-ink-2' : x.status === 'warning' ? 'text-warning' : 'text-critical'}`}>{fmtPct(x.utilization_pct, 0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* Row 3: doors into the detailed pages */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <NavModule to="/forecast" title="Forecast" description="24 h and 7 d prediction" icon={<IconForecast size={18} />} metric={f ? fmtInt(f.peak.predicted_mw) : '–'} metricLabel="MW peak" />
        <NavModule to="/alerts" title="Grid alerts" description="Active risk conditions" icon={<IconAlerts size={18} />} metric={a ? a.alerts.length : '–'} metricLabel="windows" tone={a && a.alerts.some((x) => x.level === 'critical') ? 'critical' : a && a.alerts.length ? 'warning' : 'default'} />
        <NavModule to="/areas" title="Area risk" description="Areas near capacity" icon={<IconAreas size={18} />} metric={areasAtRisk != null ? `${areasAtRisk}/${feeders.data?.feeders.length}` : '–'} metricLabel="at warning" tone={areasAtRisk ? 'warning' : 'default'} />
        <NavModule to="/weather" title="Weather impact" description="Temperature vs load" icon={<IconWeather size={18} />} metric={w?.correlation_temp_load != null ? w.correlation_temp_load.toFixed(2) : '–'} metricLabel="correlation" />
        <NavModule to="/scenario" title="Scenario simulator" description="Heat and solar what-ifs" icon={<IconScenario size={18} />} metric="±5 °C" metricLabel="range" />
        <NavModule to="/model" title="Model intelligence" description="Accuracy and drivers" icon={<IconModel size={18} />} metric={status?.model.loaded && status.model.model_mae != null ? fmtInt(status.model.model_mae) : '–'} metricLabel="MW MAE" />
      </div>
    </div>
  )
}

/** Hour-by-hour forecast bars for the next 24 h; the peak hour is white. */
function HourStrip({ points, peakTs, capacityMw }: { points: ForecastPoint[]; peakTs: string; capacityMw: number }) {
  const pts = points.slice(0, 24)
  if (!pts.length) return null
  // Scale to the data so the daily shape is legible; the capacity line is
  // drawn only when it falls inside the scaled range.
  const hi = Math.max(...pts.map((p) => p.upper_mw))
  const lo = Math.min(...pts.map((p) => p.lower_mw))
  const span = hi - lo || 1
  const max = Math.max(hi + span * 0.15, Math.min(capacityMw, hi + span * 0.6))
  const min = lo - span * 0.35
  const y = (v: number) => 100 - ((v - min) / (max - min)) * 96
  const w = 100 / pts.length
  const capInRange = capacityMw <= max
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label">Next 24 hours</span>
        <span className="text-[11px] text-ink-3">white bar = peak hour{capInRange ? ' · dashed = grid capacity' : ` · grid capacity ${fmtInt(capacityMw)} MW is above this range`}</span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label="Hourly forecast for the next 24 hours">
        {capInRange && <line x1="0" x2="100" y1={y(capacityMw)} y2={y(capacityMw)} stroke="#d64545" strokeOpacity="0.7" strokeWidth="0.4" strokeDasharray="1.5 1" vectorEffect="non-scaling-stroke" />}
        {pts.map((p, i) => {
          const peak = p.ts === peakTs
          return (
            <g key={p.ts}>
              <rect x={i * w + w * 0.2} width={w * 0.6} y={y(p.upper_mw)} height={Math.max(0, y(p.lower_mw) - y(p.upper_mw))} fill="#3987e5" fillOpacity="0.14" />
              <rect x={i * w + w * 0.2} width={w * 0.6} y={y(p.predicted_mw)} height={Math.max(0.5, 100 - y(p.predicted_mw))} fill={peak ? '#f4f4f5' : '#3987e5'} fillOpacity={peak ? 1 : 0.7} />
              <title>{`${fmtDayHour(p.ts)} IST: ${fmtInt(p.predicted_mw)} MW (${fmtInt(p.lower_mw)}–${fmtInt(p.upper_mw)})`}</title>
            </g>
          )
        })}
      </svg>
      <div className="num mt-1 flex justify-between text-[10.5px] text-ink-3">
        <span>{fmtDayHour(pts[0].ts)}</span>
        <span>{fmtDayHour(pts[Math.floor(pts.length / 2)].ts)}</span>
        <span>{fmtDayHour(pts[pts.length - 1].ts)}</span>
      </div>
    </div>
  )
}

function Figure({ label, value, unit, sub, tone = 'default', center }: { label: string; value: string; unit?: string; sub?: string; tone?: 'default' | 'good' | 'warning' | 'serious' | 'critical'; center?: boolean }) {
  const cls = { default: 'text-ink', good: 'text-good', warning: 'text-warning', serious: 'text-serious', critical: 'text-critical' }[tone]
  return (
    <div className={`min-w-0 ${center ? 'text-center' : ''}`}>
      <div className="label">{label}</div>
      <div className={`num mt-1.5 flex items-baseline gap-1 ${center ? 'justify-center' : ''} ${cls}`}>
        <span className="text-[26px] font-bold leading-none tracking-[-0.02em]">{value}</span>
        {unit && <span className="text-[10.5px] font-semibold text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="mt-1 truncate text-[11px] text-ink-3">{sub}</div>}
    </div>
  )
}
