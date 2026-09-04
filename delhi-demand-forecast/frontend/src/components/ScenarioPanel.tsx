import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../services/api.ts'
import type { WhatIfResponse } from '../types/api.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { fmtDayHour, fmtInt, fmtMW, fmtSigned } from '../utils/format.ts'
import ScenarioChart from './charts/ScenarioChart.tsx'
import KpiTile from './ui/KpiTile.tsx'
import { Badge, methodKind } from './ui/Badges.tsx'
import { HorizonSelector } from './ui/Controls.tsx'
import { ErrorState, Loading } from './ui/States.tsx'

/** Interactive what-if: temperature shift + rooftop solar. Debounced calls to
 *  POST /api/whatif; used compact on the Overview and full on its own page. */
export default function ScenarioPanel({ compact = false }: { compact?: boolean }) {
  const { capacityMw, version } = useAppState()
  const [temp, setTemp] = useState(2)
  const [solar, setSolar] = useState(500)
  const [horizon, setHorizon] = useState(24)
  const [data, setData] = useState<WhatIfResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [tick, setTick] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      api
        .whatIf({ temp_delta_c: temp, rooftop_solar_mw: solar, horizon, capacity_mw: capacityMw }, controller.signal)
        .then((d) => { setData(d); setError(null) })
        .catch((e) => { if (!controller.signal.aborted) setError(e instanceof ApiError ? e : new ApiError(String(e), 'network', null)) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 300)
    return () => window.clearTimeout(t)
  }, [temp, solar, horizon, capacityMw, version, tick])

  const delta = data?.net_delta_mw ?? 0
  const deltaTone = delta > 0 ? 'serious' : delta < 0 ? 'good' : 'default'

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-4">
        <Slider label="Temperature change" value={temp} min={-4} max={6} step={0.5} unit="°C" onChange={setTemp} format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} °C`} marks={['−4', '0', '+6']} />
        <Slider label="Rooftop solar capacity" value={solar} min={0} max={2000} step={50} unit="MW" onChange={setSolar} format={(v) => `${fmtInt(v)} MW`} marks={['0', '1,000', '2,000']} />
        {!compact && (
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Horizon</div>
            <HorizonSelector value={horizon} onChange={setHorizon} />
          </div>
        )}
        <div className="flex gap-2">
          <Preset label="Heatwave +4 °C" onClick={() => { setTemp(4); setSolar(0) }} />
          <Preset label="Solar 1.5 GW" onClick={() => { setTemp(0); setSolar(1500) }} />
          <Preset label="Reset" onClick={() => { setTemp(0); setSolar(0) }} />
        </div>
        <p className="text-[11px] leading-relaxed text-ink-3">
          Temperature shift is applied to the weather forecast and the demand model is re-run, so the response is the model's own learned sensitivity.
          Rooftop solar uses an hour-of-day generation profile (assumption; cloud cover not modelled) and is netted off grid demand.
        </p>
      </div>
      <div className="min-w-0">
        {error ? (
          <ErrorState error={error} onRetry={() => setTick((t) => t + 1)} />
        ) : !data ? (
          <Loading height="h-64" />
        ) : (
          <div className={loading ? 'opacity-60 transition' : 'transition'}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge kind={methodKind(data.forecast_method)} small />
              {data.capacity_breach ? (
                <span className="rounded border border-critical/50 bg-critical/10 px-2 py-0.5 text-[11px] font-bold text-critical">■ CAPACITY BREACH in scenario</span>
              ) : (
                <span className="rounded border border-good/40 bg-good/10 px-2 py-0.5 text-[11px] font-bold text-good">● Within capacity</span>
              )}
            </div>
            <div className={`grid gap-3 ${compact ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'}`}>
              <KpiTile label="Baseline peak" value={fmtInt(data.baseline_peak_mw)} unit="MW" sub={fmtDayHour(data.baseline_peak_ts)} tone="accent" />
              <KpiTile label="Scenario peak" value={fmtInt(data.scenario_peak_mw)} unit="MW" sub={fmtDayHour(data.scenario_peak_ts)} tone={data.capacity_breach ? 'critical' : 'default'} />
              <KpiTile label="Net change at peak" value={fmtSigned(delta, '')} unit="MW" tone={deltaTone} sub={`headroom ${fmtMW(data.grid_capacity_mw - data.scenario_peak_mw)}`} />
              {!compact && <KpiTile label="Temperature effect" value={fmtSigned(data.temp_effect_at_peak_mw, '')} unit="MW" sub="at scenario peak hour" />}
              {!compact && <KpiTile label="Solar at peak hour" value={`−${fmtInt(data.solar_at_peak_mw)}`} unit="MW" sub={`max ${fmtMW(data.solar_peak_gen_mw)} at noon`} />}
              <KpiTile label="Energy change" value={fmtSigned(data.energy_delta_mwh, '')} unit="MWh" sub={`over ${data.inputs.horizon} h`} />
            </div>
            <div className="mt-4">
              <ScenarioChart points={data.points} capacityMw={data.grid_capacity_mw} height={compact ? 220 : 320} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange, format, marks }: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  onChange: (v: number) => void; format: (v: number) => string; marks: string[]
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</span>
        <span className="num text-sm font-bold text-ink">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" aria-label={label} />
      <div className="num flex justify-between text-[10px] text-ink-3">{marks.map((m) => <span key={m}>{m}</span>)}</div>
    </div>
  )
}

function Preset({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded border border-line-strong bg-surface-2 px-2 py-1 text-[11px] font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
      {label}
    </button>
  )
}
