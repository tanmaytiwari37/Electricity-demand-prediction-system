import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { DELHI_OUTLINE, DISCOM_AREAS, type DiscomAreaProps } from '../../data/delhiDiscomAreas.ts'
import type { Feeder } from '../../types/api.ts'
import { fmtMW, fmtPct } from '../../utils/format.ts'
import { BLUE_RAMP, C, rampColor } from './theme.ts'

/** Free basemap, no API key: the standard OpenStreetMap raster tiles. They are
 *  darkened with a CSS filter (see index.css) to sit inside the control-room
 *  theme. The tiles are the only network dependency of this panel; the DISCOM
 *  polygons are bundled, so the choropleth still renders offline. */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
const DELHI_CENTER: L.LatLngTuple = [28.62, 77.15]
const FONT = '"Plus Jakarta Sans", system-ui, sans-serif'
/** Zoom at which the two small enclaves (NDMC, MES) get their full label. */
const DETAIL_ZOOM = 12

/** Where each DISCOM's label chip sits: the visual centre of its service area,
 *  hand-tuned so the chips never overlap at the default zoom. Distinct from
 *  the feeder reference coordinates in the API. */
const LABEL_ANCHOR: Record<string, L.LatLngTuple> = {
  TPDDL: [28.748, 77.105],
  BRPL: [28.548, 77.05],
  BYPL: [28.668, 77.298],
  NDMC: [28.612, 77.212],
  MES: [28.586, 77.126],
}
const SMALL_AREAS = new Set(['NDMC', 'MES'])

type TileState = 'loading' | 'ok' | 'failed'

const byDiscom = (rows: Feeder[]) => new Map(rows.map((f) => [f.discom, f]))
const scaleOf = (rows: Feeder[]) => Math.max(100, ...rows.map((f) => f.utilization_pct))
const toneOf = (f: Feeder) => (f.status === 'critical' ? C.critical : f.status === 'warning' ? C.warning : C.good)

/** Fill colour follows the same rule as the heatmap: sequential blue by
 *  allocated utilisation (brighter = higher on the dark surface), overridden by
 *  the warning / critical status colour so a stressed area is never
 *  colour-by-magnitude alone. */
function fillFor(f: Feeder | undefined, scaleMax: number): string {
  if (!f) return C.axis
  if (f.status === 'critical') return C.critical
  if (f.status === 'warning') return C.warning
  return rampColor(Math.max(0, Math.min(0.999, f.utilization_pct / scaleMax)))
}

function areaStyle(f: Feeder | undefined, scaleMax: number, hover = false): L.PathOptions {
  return {
    color: hover ? C.ink : C.ink2,
    weight: hover ? 2.2 : 1.1,
    opacity: hover ? 1 : 0.85,
    fillColor: fillFor(f, scaleMax),
    fillOpacity: hover ? 0.7 : 0.55,
  }
}

function tooltipHtml(f: Feeder | undefined, p: DiscomAreaProps): string {
  const head = `<div style="font:600 12px ${FONT};color:${C.ink}">${f ? f.name : p.discom}</div>`
  if (!f) return head
  return (
    head +
    `<div style="font:11px ${FONT};color:${C.ink2};margin-top:3px;font-variant-numeric:tabular-nums;line-height:1.5">` +
    `Allocated ≈ <b style="color:${C.ink}">${fmtMW(f.predicted_mw)}</b> of assumed ${fmtMW(f.capacity_mw)}<br/>` +
    `Utilisation <b style="color:${toneOf(f)}">${fmtPct(f.utilization_pct)}</b> · ${f.status.toUpperCase()} · share ${fmtPct(f.share_pct, 0)}` +
    `<br/><span style="color:${C.tick}">Service area ≈ ${p.area_km2} km² (approx. edges). Not measured.</span></div>`
  )
}

function labelHtml(f: Feeder, compact: boolean): string {
  const tone = f.status === 'ok' ? C.ink : toneOf(f)
  const val = compact ? fmtPct(f.utilization_pct, 0) : `≈ ${fmtMW(f.predicted_mw)} · ${fmtPct(f.utilization_pct, 0)}`
  return (
    `<div class="pw-map-label${compact ? ' pw-map-label--compact' : ''}" style="border-color:${f.status === 'ok' ? 'var(--color-line-strong)' : tone}">` +
    `<span class="pw-map-label__name" style="color:${tone}">${f.discom}</span>` +
    `<span class="pw-map-label__val">${val}</span></div>`
  )
}

/** Real Delhi map: OpenStreetMap basemap, the NCT outline, and the five DISCOM
 *  service areas coloured by ALLOCATED utilisation (system forecast x share).
 *  Boundaries are approximate; figures are not measurements. */
export default function DelhiMap({ feeders, height = 480 }: { feeders: Feeder[]; height?: number }) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const areas = useRef<L.GeoJSON<DiscomAreaProps> | null>(null)
  const labels = useRef<Map<string, L.Marker>>(new Map())
  const feedersRef = useRef<Feeder[]>(feeders)
  const [tiles, setTiles] = useState<TileState>(typeof navigator !== 'undefined' && navigator.onLine === false ? 'failed' : 'loading')
  const [detail, setDetail] = useState(false)

  // Build the map once. Data-driven styling is applied in the second effect so
  // the hour slider never tears the map down.
  useEffect(() => {
    if (!host.current || map.current) return
    const m = L.map(host.current, {
      center: DELHI_CENTER,
      zoom: 10,
      minZoom: 9,
      maxZoom: 16,
      scrollWheelZoom: false,
      attributionControl: true,
      zoomControl: true,
      maxBounds: L.latLngBounds([28.2, 76.5], [29.05, 77.7]),
      maxBoundsViscosity: 0.8,
    })
    m.attributionControl.setPrefix('')
    map.current = m

    let loadedOne = false
    const tileLayer = L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19, crossOrigin: true })
    tileLayer.on('tileload', () => {
      if (!loadedOne) {
        loadedOne = true
        setTiles('ok')
      }
    })
    tileLayer.on('tileerror', () => {
      if (!loadedOne) setTiles('failed')
    })
    tileLayer.addTo(m)

    L.geoJSON(DELHI_OUTLINE, { style: { color: C.ink, weight: 1.6, opacity: 0.8, fill: false, dashArray: '4 3' }, interactive: false }).addTo(m)

    const rows = feedersRef.current
    const lookup = byDiscom(rows)
    const scale = scaleOf(rows)
    const layer = L.geoJSON<DiscomAreaProps>(DISCOM_AREAS, {
      style: (feat) => areaStyle(lookup.get(feat?.properties.discom ?? ''), scale),
      onEachFeature: (feat, lyr) => {
        const path = lyr as L.Path
        path.bindTooltip(() => tooltipHtml(byDiscom(feedersRef.current).get(feat.properties.discom), feat.properties), {
          sticky: true,
          direction: 'top',
          opacity: 1,
          className: 'pw-map-tip',
        })
        path.on('mouseover', () => {
          path.setStyle(areaStyle(byDiscom(feedersRef.current).get(feat.properties.discom), scaleOf(feedersRef.current), true))
          path.bringToFront()
        })
        path.on('mouseout', () => path.setStyle(areaStyle(byDiscom(feedersRef.current).get(feat.properties.discom), scaleOf(feedersRef.current))))
      },
    }).addTo(m)
    areas.current = layer
    m.fitBounds(layer.getBounds(), { padding: [8, 8] })

    // Keep NDMC and MES (the two small enclaves) above the larger areas so
    // they stay hoverable.
    layer.eachLayer((lyr) => {
      const p = (lyr as L.Polygon).feature?.properties as DiscomAreaProps | undefined
      if (p && SMALL_AREAS.has(p.discom)) (lyr as L.Path).bringToFront()
    })

    const onZoom = () => setDetail(m.getZoom() >= DETAIL_ZOOM)
    m.on('zoomend', onZoom)
    onZoom()

    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(host.current)
    const labelStore = labels.current

    return () => {
      ro.disconnect()
      m.off('zoomend', onZoom)
      labelStore.clear()
      areas.current = null
      m.remove()
      map.current = null
    }
  }, [])

  // Re-style polygons and rewrite labels whenever the allocated rows change or
  // the zoom crosses the detail threshold.
  useEffect(() => {
    feedersRef.current = feeders
    const m = map.current
    if (!m || !areas.current) return
    const lookup = byDiscom(feeders)
    const scale = scaleOf(feeders)
    areas.current.eachLayer((lyr) => {
      const p = (lyr as L.Polygon).feature?.properties as DiscomAreaProps | undefined
      if (p) (lyr as L.Path).setStyle(areaStyle(lookup.get(p.discom), scale))
    })
    for (const f of feeders) {
      const compact = SMALL_AREAS.has(f.discom) && !detail
      const icon = L.divIcon({ className: 'pw-map-label-wrap', html: labelHtml(f, compact), iconSize: undefined, iconAnchor: [0, 0] })
      const at = LABEL_ANCHOR[f.discom] ?? ([f.lat, f.lon] as L.LatLngTuple)
      const existing = labels.current.get(f.id)
      if (existing) {
        existing.setIcon(icon)
        existing.setLatLng(at)
      } else {
        const mk = L.marker(at, { icon, interactive: false, keyboard: false })
        mk.addTo(m)
        labels.current.set(f.id, mk)
      }
    }
    for (const [id, mk] of labels.current) {
      if (!feeders.some((f) => f.id === id)) {
        mk.remove()
        labels.current.delete(id)
      }
    }
  }, [feeders, detail])

  const scaleMax = scaleOf(feeders)

  return (
    <div>
      <div className="relative isolate">
        <div
          ref={host}
          className="w-full overflow-hidden rounded-[6px] border border-line bg-surface-0"
          style={{ height }}
          role="region"
          aria-label="Map of Delhi DISCOM service areas coloured by allocated utilisation. Boundaries approximate; figures allocated, not measured."
        />

        {tiles === 'failed' && (
          <div className="pointer-events-none absolute top-2 left-1/2 z-[500] -translate-x-1/2 rounded-[6px] border border-warning/45 bg-surface-1/95 px-3 py-1.5 text-[11px] font-medium text-warning shadow-sm" role="status">
            ▲ Basemap tiles unavailable (offline). Showing bundled area boundaries only.
          </div>
        )}

        <div className="pointer-events-none absolute bottom-6 left-2 z-[500] rounded-[6px] border border-line bg-surface-1/92 px-2.5 py-2 text-[10.5px] text-ink-2 shadow-sm">
          <div className="label mb-1">Allocated utilisation</div>
          <div className="flex items-center gap-1.5">
            <span className="num">0%</span>
            <span className="inline-block h-2 w-20 rounded-sm" style={{ background: `linear-gradient(90deg,${BLUE_RAMP[0]},${BLUE_RAMP[5]},${BLUE_RAMP[BLUE_RAMP.length - 1]})` }} />
            <span className="num">{fmtPct(scaleMax, 0)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.warning }} /> warning</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C.critical }} /> critical</span>
          </div>
        </div>
      </div>

      <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-3">
        Basemap © OpenStreetMap contributors (no API key). Outer boundary is the NCT of Delhi from OpenStreetMap; DISCOM edges are drawn approximately along published licence areas. Fill = allocated load ÷ assumed area capacity. Hover an area for detail; zoom in for NDMC and MES figures. Not a measurement.
      </p>
    </div>
  )
}
