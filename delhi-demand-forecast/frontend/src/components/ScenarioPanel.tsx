import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../services/api.ts'
import type { WhatIfResponse } from '../types/api.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { fmtDayHour, fmtInt, fmtMW, fmtPct, fmtSigned } from '../utils/format.ts'
import ScenarioChart, { SolarStrip } from './charts/ScenarioChart.tsx'
import Button from './ui/Button.tsx'
import KpiTile, { StatStrip } from './ui/KpiTile.tsx'
import Panel from './ui/Panel.tsx'
import { HorizonSelector, Slider } from './ui/Controls.tsx'
import { ErrorState, Loading } from './ui/States.tsx'

interface Inputs { temp: number; solar: number; horizon: number }

/** Scenario simulator: temperature shift + rooftop solar against the
 *  baseline forecast. Inputs are staged; RUN SCENARIO posts them to
 *  /api/whatif. Presets run immediately. */
export default function ScenarioPanel() {
  const { capacityMw, version } = useAppState()
  const [draft, setDraft] = useState<Inputs>({ temp: 2, solar: 500, horizon: 24 })
  const [applied, setApplied] = useState<Inputs>(draft)
  const [data, setData] = useState<WhatIfResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [tick, setTick] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    api
      .whatIf({ temp_delta_c: applied.temp, rooftop_solar_mw: applied.solar, horizon: applied.horizon, capacity_mw: capacityMw }, controller.signal)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof ApiError ? e : new ApiError(String(e), 'network', null)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [applied, capacityMw, version, tick])

  const dirty = draft.temp !== applied.temp || draft.solar !== applied.solar || draft.horizon !== applied.horizon
  const run = (next: Inputs = draft) => { setDraft(next); setApplied(next) }

  const delta = data?.net_delta_mw ?? 0
  const deltaTone = delta > 0 ? 'serious' : delta < 0 ? 'good' : 'default'

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
      <Panel title="Inputs" className="xl:self-start" bodyClassName="flex flex-col gap-6">
        <Slider label="Temperature change" value={draft.temp} min={-5} max={5} step={0.5} onChange={(v) => setDraft({ ...draft, temp: v })} format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} °C`} marks={['−5 °C', '0', '+5 °C']} />
        <Slider label="Rooftop solar generation" value={draft.solar} min={0} max={2000} step={50} onChange={(v) => setDraft({ ...draft, solar: v })} format={(v) => `${fmtInt(v)} MW`} marks={['0', '1,000', '2,000 MW']} />
        <div>
          <div className="label mb-2">Forecast horizon</div>
          <HorizonSelector value={draft.horizon} onChange={(h) => setDraft({ ...draft, horizon: h })} options={[24, 168]} />
        </div>
        <div className="flex flex-col gap-3 border-t border-line pt-5">
          <Button variant="primary" size="lg" arrow onClick={() => run()} disabled={loading}>{loading ? 'Running…' : 'Run scenario'}</Button>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" onClick={() => run({ ...draft, temp: 4, solar: 0 })}>Heatwave +4 °C</Button>
            <Button size="sm" onClick={() => run({ ...draft, temp: 0, solar: 1500 })}>Solar 1.5 GW</Button>
            <Button size="sm" variant="ghost" onClick={() => run({ ...draft, temp: 0, solar: 0 })}>Reset</Button>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-3">
            {dirty ? 'Inputs changed. Results show the last run.' : 'The temperature shift is applied to the weather forecast and the model is re-run. Solar uses an hour-of-day profile; cloud cover is not modelled.'}
          </p>
        </div>
      </Panel>

      <div className="flex min-w-0 flex-col gap-5">
        {error ? (
          <ErrorState error={error} onRetry={() => setTick((t) => t + 1)} />
        ) : !data ? (
          <Panel><Loading height="h-64" /></Panel>
        ) : (
          <div className={`flex flex-col gap-5 transition-opacity duration-150 ${loading ? 'opacity-60' : ''}`}>
            <StatStrip cols="md:grid-cols-4">
              <KpiTile flat size="lg" label="Baseline peak" value={fmtInt(data.baseline_peak_mw)} unit="MW" sub={`${fmtDayHour(data.baseline_peak_ts)} IST`} />
              <KpiTile flat size="lg" label="Scenario peak" value={fmtInt(data.scenario_peak_mw)} unit="MW" sub={`${fmtDayHour(data.scenario_peak_ts)} IST`} tone={data.capacity_breach ? 'critical' : 'default'} />
              <KpiTile flat size="lg" label="Net change" value={fmtSigned(delta, '')} unit="MW" tone={deltaTone} sub={`headroom ${fmtMW(data.grid_capacity_mw - data.scenario_peak_mw)}`} />
              <KpiTile flat size="lg" label="Capacity breach" value={data.capacity_breach ? 'YES' : 'NO'} tone={data.capacity_breach ? 'critical' : 'good'} sub={`capacity ${fmtMW(data.grid_capacity_mw)}`} />
            </StatStrip>

            <Panel title="Baseline vs scenario" subtitle={`${data.inputs.temp_delta_c > 0 ? '+' : ''}${data.inputs.temp_delta_c} °C · ${fmtInt(data.inputs.rooftop_solar_mw)} MW rooftop solar · ${data.inputs.horizon} h`}>
              <ScenarioChart points={data.points} capacityMw={data.grid_capacity_mw} height={320} />
              <div className="mt-5 grid gap-8 border-t border-line pt-5 md:grid-cols-[1fr_1fr_1.3fr]">
                <Bar label="Baseline" mw={data.baseline_peak_mw} cap={data.grid_capacity_mw} cls="bg-series-blue" />
                <Bar label="Scenario" mw={data.scenario_peak_mw} cap={data.grid_capacity_mw} cls={data.capacity_breach ? 'bg-critical' : 'bg-series-orange'} />
                <dl className="num grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
                  <Fact k="Temperature effect at peak" v={fmtSigned(data.temp_effect_at_peak_mw)} />
                  <Fact k="Solar at peak hour" v={`−${fmtInt(data.solar_at_peak_mw)} MW`} />
                  <Fact k="Solar peak output" v={fmtMW(data.solar_peak_gen_mw)} />
                  <Fact k="Energy change" v={`${fmtSigned(data.energy_delta_mwh, '')} MWh`} />
                </dl>
              </div>
            </Panel>

            {data.inputs.rooftop_solar_mw > 0 && (
              <Panel title="Rooftop solar contribution" subtitle="Generation profile netted off grid demand, on its own axis.">
                <SolarStrip points={data.points} />
              </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Bar({ label, mw, cap, cls }: { label: string; mw: number; cap: number; cls: string }) {
  const pct = Math.min(100, (mw / cap) * 100)
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="num text-sm font-bold text-ink">{fmtInt(mw)} <span className="text-[10.5px] font-semibold text-ink-3">MW · {fmtPct(pct, 0)}</span></span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-sm bg-surface-3" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} as share of capacity`}>
        <div className={`h-full rounded-sm ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="label">{k}</dt>
      <dd className="mt-0.5 truncate font-semibold text-ink">{v}</dd>
    </div>
  )
}
