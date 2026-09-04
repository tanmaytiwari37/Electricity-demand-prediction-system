import { useState } from 'react'
import type { Feeder, FeederHour } from '../../types/api.ts'
import { fmtDateTime, fmtHour, fmtPct } from '../../utils/format.ts'
import { rampColor } from './theme.ts'

/** Area x hour utilisation grid. Sequential blue ramp for magnitude; cells at
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
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-3">
        <span className="flex items-center gap-1">
          0%
          <span className="inline-block h-2 w-24 rounded" style={{ background: 'linear-gradient(90deg,#184f95,#3987e5,#b7d3f6)' }} />
          {fmtPct(max, 0)}
        </span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border-2 border-warning align-middle" />≥ {warningPct}% warning</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border-2 border-critical align-middle" />≥ {criticalPct}% critical</span>
      </div>
      {hover && (
        <div className="pointer-events-none absolute right-2 top-0 rounded border border-line-strong bg-surface-2/95 px-3 py-2 text-xs shadow-lg">
          <div className="font-semibold">{hover.f.name}</div>
          <div className="text-ink-2">{fmtDateTime(hover.h.ts)}</div>
          <div className="num mt-1 font-semibold">{fmtPct(hover.v)} of capacity</div>
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
        const ring = v >= criticalPct ? '#d03b3b' : v >= warningPct ? '#fab219' : 'transparent'
        return (
          <button
            key={h.ts}
            aria-label={`${f.name} ${fmtHour(h.ts)}: ${fmtPct(v)}`}
            onMouseEnter={() => onHover({ f, h, v })}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover({ f, h, v })}
            onBlur={() => onHover(null)}
            className="mx-px h-6 rounded-sm"
            style={{ background: rampColor(v / max), boxShadow: `inset 0 0 0 2px ${ring}` }}
          />
        )
      })}
    </>
  )
}
