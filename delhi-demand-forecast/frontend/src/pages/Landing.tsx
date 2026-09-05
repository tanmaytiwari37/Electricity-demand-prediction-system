import { useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import WeatherEmblem from '../components/landing/WeatherEmblem.tsx'
import CloudLayer from '../components/layout/CloudLayer.tsx'
import { IconAlerts, IconAreas, IconArrow, IconForecast, IconModel, IconScenario, IconWeather, Logo } from '../components/ui/Icons.tsx'
import { sourceWord } from '../components/ui/Badges.tsx'
import { useApi } from '../hooks/useApi.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { api } from '../services/api.ts'
import { fmtDayHour, fmtInt, riskMeta } from '../utils/format.ts'

/** Front page. The emblem, the title and the CTA sit on a bright sky with
 *  drifting clouds; clicking anything that leads inside zooms the page into
 *  the dashboard. Live figures on the cards come from the same API the
 *  dashboard uses, so nothing here is decorative data. */
export default function Landing() {
  const navigate = useNavigate()
  const { status, capacityMw, version } = useAppState()
  const forecast = useApi((s) => api.forecast(24, capacityMw, s), [capacityMw, version])
  const alerts = useApi((s) => api.alerts(24, capacityMw, s), [capacityMw, version])
  const feeders = useApi((s) => api.feeders({ horizon: 24, capacityMw }, s), [capacityMw, version])
  const [entering, setEntering] = useState(false)
  const [origin, setOrigin] = useState('50% 30%')

  const f = forecast.data, a = alerts.data
  const tempNow = f?.points[0]?.temp_c ?? null
  const areasAtRisk = feeders.data ? feeders.data.feeders.filter((x) => x.status !== 'ok').length : null

  // Zoom towards the element that was clicked, then route.
  const enter = (to: string, e?: MouseEvent | KeyboardEvent) => {
    if (entering) return
    const el = (e?.currentTarget as HTMLElement | undefined)
    if (el) {
      const r = el.getBoundingClientRect()
      setOrigin(`${r.left + r.width / 2}px ${r.top + r.height / 2}px`)
    }
    setEntering(true)
    window.setTimeout(() => navigate(to), 650)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-0 text-ink">
      <CloudLayer opacity={0.6} />
      <div className={`lp-root relative z-[1] min-h-screen ${entering ? 'lp-entering' : ''}`} style={{ '--lp-origin': origin } as CSSProperties}>
        {/* field */}
        <div className="lp-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[70vh]" aria-hidden style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 28%, rgba(42,120,214,0.12), transparent 70%)' }} />

        {/* top bar */}
        <header className="lp-rise relative z-10 flex items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="lp-display text-[13px] font-bold tracking-[0.22em] text-ink">PEAKWATCH</span>
          </div>
          <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.14em] text-ink-3">
            <span className="hidden sm:inline">Delhi DISCOM · SLDC decision support</span>
            {status && <span className="rounded-md border border-line bg-surface-1/80 px-2 py-1 text-ink-2">{sourceWord(status.history.source, status.weather.source)} DATA</span>}
          </div>
        </header>

        {/* hero */}
        <main className="relative z-10 flex flex-col items-center px-6 pb-16 text-center">
          <div className="lp-rise mt-2 lg:mt-4" style={{ '--delay': '80ms' } as CSSProperties}>
            <WeatherEmblem tempC={tempNow} size={400} onClick={() => enter('/overview')} />
          </div>

          <h1 className="lp-display lp-rise mt-6 text-[34px] font-extrabold leading-[1.1] tracking-[0.06em] sm:text-[48px] lg:text-[60px]" style={{ '--delay': '160ms' } as CSSProperties}>
            <span className="text-ink">DELHI ENERGY &amp;</span>
            <br />
            <span className="lp-gradient-text">WEATHER INTELLIGENCE</span>
          </h1>
          <p className="lp-rise mt-5 font-mono text-[12px] uppercase tracking-[0.28em] text-ink-2 sm:text-[13px]" style={{ '--delay': '240ms' } as CSSProperties}>AI-powered electricity demand forecasting &amp; early warning</p>
          <p className="lp-rise mt-2 text-[13px] italic text-ink-3" style={{ '--delay': '280ms' } as CSSProperties}>Predict the peak. Prevent the risk.</p>

          <div className="lp-rise mt-6 h-px w-40 bg-gradient-to-r from-transparent via-series-blue/60 to-transparent" aria-hidden style={{ '--delay': '320ms' } as CSSProperties} />

          <ul className="lp-rise mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-mono text-[12px] tracking-[0.14em] text-ink-2" style={{ '--delay': '360ms' } as CSSProperties}>
            <li className="flex items-center gap-2"><Dot color="#3987e5" />Weather → Energy</li>
            <li className="flex items-center gap-2"><Dot color="#199e70" />AI Forecasting</li>
            <li className="flex items-center gap-2"><Dot color="#9085e9" />Peak Risk Alerts</li>
          </ul>

          <button
            onClick={(e) => enter('/overview', e)}
            className="lp-cta lp-display lp-rise mt-10 inline-flex items-center gap-4 rounded-lg bg-series-blue px-10 py-4 text-[15px] font-bold tracking-[0.24em] text-white"
            style={{ '--delay': '420ms' } as CSSProperties}
          >
            ENTER DASHBOARD <IconArrow size={20} />
          </button>
          <p className="lp-rise mt-4 font-mono text-[10.5px] uppercase tracking-[0.2em] text-ink-3" style={{ '--delay': '460ms' } as CSSProperties}>Authorised access · Delhi DISCOM intelligence platform</p>

          {/* feature cards */}
          <div className="mt-14 grid w-full max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card delay="520ms" onClick={(e) => enter('/forecast', e)} icon={<IconForecast size={18} />} title="24-hour forecast" text="Demand prediction with interval and peak marker." metric={f ? `${fmtInt(f.peak.predicted_mw)} MW` : '…'} sub={f ? `peak at ${fmtDayHour(f.peak.ts)}` : 'loading'} />
            <Card delay="580ms" onClick={(e) => enter('/alerts', e)} icon={<IconAlerts size={18} />} title="Peak risk alerts" text="Capacity headroom and recommended actions." metric={a ? riskMeta[a.risk_level].label : '…'} metricClass={a ? riskMeta[a.risk_level].text : ''} sub={a ? `${a.alerts.length} active window${a.alerts.length === 1 ? '' : 's'} · ${fmtInt(a.headroom_mw)} MW headroom` : 'loading'} />
            <Card delay="640ms" onClick={(e) => enter('/areas', e)} icon={<IconAreas size={18} />} title="Area intelligence" text="DISCOM-wise load, utilisation and risk." metric={areasAtRisk != null ? `${areasAtRisk} / ${feeders.data?.feeders.length}` : '…'} sub="areas at warning or above" />
            <Card delay="700ms" onClick={(e) => enter('/weather', e)} icon={<IconWeather size={18} />} title="Weather impact" text="Temperature–load relationship and sensitivity." metric={tempNow != null ? `${tempNow.toFixed(1)} °C` : '…'} sub={f?.points[0]?.humidity != null ? `humidity ${fmtInt(f.points[0].humidity)}% · now` : 'now'} />
          </div>

          <div className="lp-rise mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[12px] text-ink-2" style={{ '--delay': '760ms' } as CSSProperties}>
            <button onClick={(e) => enter('/scenario', e)} className="pressable inline-flex items-center gap-1.5 hover:text-series-blue"><IconScenario size={14} />Scenario simulator</button>
            <button onClick={(e) => enter('/model', e)} className="pressable inline-flex items-center gap-1.5 hover:text-series-blue"><IconModel size={14} />Model intelligence</button>
          </div>
        </main>
      </div>
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} aria-hidden />
}

function Card({ onClick, icon, title, text, metric, metricClass = 'text-ink', sub, delay }: { onClick: (e: MouseEvent) => void; icon: ReactNode; title: string; text: string; metric: string; metricClass?: string; sub: string; delay: string }) {
  return (
    <button onClick={onClick} className="lp-card lp-rise card group flex flex-col rounded-lg border border-line bg-surface-1/85 p-5 text-left" style={{ '--delay': delay } as CSSProperties}>
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-md border border-series-blue/30 bg-series-blue/14 text-series-blue">{icon}</span>
        <IconArrow size={16} className="text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-series-blue" />
      </div>
      <div className="mt-4 text-[14px] font-semibold text-ink">{title}</div>
      <div className="mt-1 text-[12px] leading-relaxed text-ink-3">{text}</div>
      <div className={`num mt-4 text-2xl font-bold leading-none ${metricClass}`}>{metric}</div>
      <div className="mt-1 text-[11px] text-ink-3">{sub}</div>
    </button>
  )
}
