import { useState } from 'react'
import type { Feeder, FeederHour } from '../../types/api.ts'
import { fmtDateTime, fmtHour, fmtPct } from '../../utils/format.ts'
import { BLUE_RAMP, C, rampColor } from './theme.ts'

/** Area x hour ALLOCATED utilisation grid (system forecast × share; not measured). Sequential blue ramp for magnitude (brighter = higher); cells at
 *  or above the critical threshold get a red ring plus a mark so the state is
 *  never colour-alone. */
export default function FeederHeatmap({ feeders, hourly, warningPct = 85, criticalPct = 95 }: { feeders: Feeder[]; hourly: FeederHour[]; warningPct?: number; criticalPct?: number }) {
  const [hover, setHover] = useState<{ f: Feeder; h: FeederHour; v: number } | null>(null)
  const max = Math.max(100, ...hourly.flatMap((h) => Object.values(h.utilization_pct)))
  return (
    <div className="relative">
      <div className="overflow-x-auto scroll-thin">
        <div className="grid min-w-[640px] gap-y-1 text-[11px]" style={{ gridTemplateColumns: `160px repeat(${hourly.length}, minmax(0, 1fr))` }}>
          <div />
          {hourly.map((h, i) => (
            <div key={h.ts} className="num truncate text-center text-ink-3">{i % Math.ceil(hourly.length / 12) === 0 ? fmtHour(h.ts) : ''}</div>
          ))}
          {feeders.map((f) => (
            <FeederRow key={f.id} f={f} hourly={hourly} max={max} warningPct={warningPct} criticalPct={criticalPct} onHover={setHover} />
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10.5px] text-ink-3">
        <span className="flex items-center gap-1">
          0%
          <span className="inline-block h-2 w-24 rounded-sm" style={{ background: `linear-gradient(90deg,${BLUE_RAMP[0]},${BLUE_RAMP[5]},${BLUE_RAMP[BLUE_RAMP.length - 1]})` }} />
          {fmtPct(max, 0)}
        </span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border-2 border-warning align-middle" />≥ {warningPct}% warning</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border-2 border-critical align-middle" />≥ {criticalPct}% critical</span>
      </div>
      {hover && (
        <div className="pointer-events-none absolute right-2 top-0 rounded-[6px] border border-line-strong bg-surface-2/95 px-3 py-2 text-[11px] shadow-[0_18px_36px_-12px_rgba(0,0,0,0.7)]">
          <div className="font-semibold text-ink">{hover.f.name}</div>
          <div className="text-ink-2">{fmtDateTime(hover.h.ts)}</div>
          <div className="num mt-1 font-semibold text-ink">≈ {fmtPct(hover.v)} of assumed area capacity</div>
          <div className="text-[10px] text-series-magenta">allocated, not measured</div>
        </div>
      )}
    </div>
  )
}

function FeederRow({ f, hourly, max, warningPct, criticalPct, onHover }: {
  f: Feeder; hourly: FeederHour[]; max: number; warningPct: number; criticalPct: number
  onHover: (h: { f: Feeder; h: FeederHour; v: number } | null) => void
}) {
  return (
    <>
      <div className="truncate pr-2 text-ink-2" title={f.name}>{f.name}</div>
      {hourly.map((h) => {
        const v = h.utilization_pct[f.id] ?? 0
        const ring = v >= criticalPct ? C.critical : v >= warningPct ? C.warning : 'transparent'
        return (
          <button
            key={h.ts}
            aria-label={`${f.name} ${fmtHour(h.ts)}: allocated ${fmtPct(v)}`}
            onMouseEnter={() => onHover({ f, h, v })}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover({ f, h, v })}
            onBlur={() => onHover(null)}
            className="mx-px h-6 rounded-[2px]"
            style={{ background: rampColor(v / max), boxShadow: `inset 0 0 0 2px ${ring}` }}
          />
        )
      })}
    </>
  )
}
