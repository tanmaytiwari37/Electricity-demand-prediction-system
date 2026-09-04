import type { Feeder } from '../../types/api.ts'
import { fmtMW, fmtPct } from '../../utils/format.ts'
import { C } from './theme.ts'

const STATUS_COLOR = { ok: C.good, warning: C.warning, critical: C.critical }

/** Lightweight schematic: DISCOM areas positioned by lat/lon, circle area
 *  proportional to ALLOCATED MW (system forecast × share), colour + ring by
 *  status. Not a GIS map and not a measurement. */
export default function AreaMap({ feeders, height = 300 }: { feeders: Feeder[]; height?: number }) {
  const w = 480, h = height
  const lats = feeders.map((f) => f.lat), lons = feeders.map((f) => f.lon)
  const [minLat, maxLat] = [Math.min(...lats) - 0.05, Math.max(...lats) + 0.05]
  const [minLon, maxLon] = [Math.min(...lons) - 0.06, Math.max(...lons) + 0.06]
  const x = (lon: number) => 40 + ((lon - minLon) / (maxLon - minLon)) * (w - 80)
  const y = (lat: number) => h - 30 - ((lat - minLat) / (maxLat - minLat)) * (h - 60)
  const maxMw = Math.max(...feeders.map((f) => f.predicted_mw))
  const r = (mw: number) => 12 + Math.sqrt(mw / maxMw) * 30

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Schematic map of DISCOM areas showing allocated, not measured, load">
        <defs>
          <pattern id="gridp" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke={C.grid} strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width={w} height={h} fill="url(#gridp)" rx="8" />
        <text x={12} y={16} fill={C.tick} fontSize="10">N ↑</text>
        {feeders.map((f) => (
          <g key={f.id}>
            <circle cx={x(f.lon)} cy={y(f.lat)} r={r(f.predicted_mw)} fill={STATUS_COLOR[f.status]} fillOpacity={0.18} stroke={STATUS_COLOR[f.status]} strokeWidth={f.status === 'ok' ? 1.5 : 3} />
            <circle cx={x(f.lon)} cy={y(f.lat)} r={4} fill={STATUS_COLOR[f.status]} stroke={C.surface} strokeWidth={1.5} />
            <text x={x(f.lon)} y={y(f.lat) + r(f.predicted_mw) + 14} textAnchor="middle" fill={C.ink} fontSize="11" fontWeight="600">{f.discom}</text>
            <text x={x(f.lon)} y={y(f.lat) + r(f.predicted_mw) + 27} textAnchor="middle" fill={C.ink2} fontSize="10" fontStyle="italic" className="num">≈ {fmtMW(f.predicted_mw)} · ≈ {fmtPct(f.utilization_pct, 0)}</text>
            <title>{`${f.name}: allocated ≈ ${fmtMW(f.predicted_mw)} of assumed ${fmtMW(f.capacity_mw)} (≈ ${fmtPct(f.utilization_pct)}) – ${f.status}. Not measured.`}</title>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-[11px] text-ink-3">Schematic layout from area coordinates. Circle area ∝ allocated load (system forecast × share); ring colour = status. Not a GIS map, not a measurement.</p>
    </div>
  )
}
