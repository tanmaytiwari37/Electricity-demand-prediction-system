import { useMemo, useState } from 'react'
import AllocationNotice from '../components/AllocationNotice.tsx'
import AreaMap from '../components/charts/AreaMap.tsx'
import DelhiMap from '../components/charts/DelhiMap.tsx'
import FeederHeatmap from '../components/charts/FeederHeatmap.tsx'
import FeederTable from '../components/FeederTable.tsx'
import Button from '../components/ui/Button.tsx'
import { Segmented } from '../components/ui/Controls.tsx'
import KpiTile, { StatStrip } from '../components/ui/KpiTile.tsx'
import Panel, { PageHeader } from '../components/ui/Panel.tsx'
import { SourceLine, methodKind } from '../components/ui/Badges.tsx'
import { ErrorState, Loading } from '../components/ui/States.tsx'
import { useApi } from '../hooks/useApi.ts'
import { useAppState } from '../hooks/useAppState.tsx'
import { api } from '../services/api.ts'
import type { Feeder } from '../types/api.ts'
import { fmtDateTime, fmtDayHour, fmtInt } from '../utils/format.ts'

export default function Areas() {
  const { capacityMw, version, status } = useAppState()
  const [hourIdx, setHourIdx] = useState<number | null>(null)
  const [mapView, setMapView] = useState<'map' | 'schematic'>('map')
  const feeders = useApi((s) => api.feeders({ horizon: 24, capacityMw }, s), [capacityMw, version])
  const d = feeders.data

  // Re-derive per-area rows for the selected hour from the hourly grid so the
  // slider never triggers a round-trip.
  const view = useMemo<{ ts: string; rows: Feeder[]; system: number } | null>(() => {
    if (!d) return null
    if (hourIdx == null) return { ts: d.as_of, rows: d.feeders, system: d.system_mw }
    const h = d.hourly[hourIdx]
    const rows = d.feeders.map((f) => {
      const util = h.utilization_pct[f.id] ?? 0
      const predicted = (f.capacity_mw * util) / 100
      const status = util >= 95 ? 'critical' : util >= 85 ? 'warning' : 'ok'
      return { ...f, utilization_pct: util, predicted_mw: Math.round(predicted * 10) / 10, status } as Feeder
    })
    return { ts: h.ts, rows, system: h.system_mw }
  }, [d, hourIdx])

  const worst = view ? [...view.rows].sort((a, b) => b.utilization_pct - a.utilization_pct)[0] : null
  const peakIdx = d ? d.hourly.findIndex((h) => h.ts === d.as_of) : 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Area intelligence"
        subtitle="The system forecast split across Delhi's five distribution licensees by configured share."
        sources={d && <SourceLine kinds={[methodKind(d.forecast_method), 'allocated']} />}
      />

      <AllocationNotice shares={status?.assumptions.discom_share} />

      {feeders.loading && !d ? <Loading height="h-64" /> : feeders.error ? <ErrorState error={feeders.error} onRetry={feeders.refetch} /> : d && view && (
        <>
          <StatStrip cols="md:grid-cols-4">
            <KpiTile flat label="System forecast" value={fmtInt(view.system)} unit="MW" sub={fmtDateTime(view.ts)} />
            <KpiTile flat label="Most loaded area" value={worst ? worst.discom : '–'} sub={worst ? `${worst.utilization_pct.toFixed(1)}% of assumed capacity` : '–'} tone={worst?.status === 'critical' ? 'critical' : worst?.status === 'warning' ? 'warning' : 'default'} />
            <KpiTile flat label="Areas at warning" value={view.rows.filter((r) => r.status !== 'ok').length} unit={`of ${view.rows.length}`} tone={view.rows.some((r) => r.status !== 'ok') ? 'warning' : 'default'} />
            <KpiTile flat label="Evaluated at" value={hourIdx == null ? 'Peak hour' : fmtDayHour(view.ts).split(' ').slice(-1)[0]} sub={hourIdx == null ? fmtDayHour(d.as_of) : 'selected hour'} />
          </StatStrip>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Areas" subtitle={`At ${fmtDateTime(view.ts)} · click a column to sort`} actions={hourIdx != null && <Button size="sm" onClick={() => setHourIdx(null)}>Back to peak hour</Button>}>
              <div className="mb-4 flex items-center gap-4 border-b border-line pb-4">
                <span className="label shrink-0">Hour</span>
                <input type="range" min={0} max={d.hourly.length - 1} value={hourIdx ?? peakIdx} onChange={(e) => setHourIdx(Number(e.target.value))} aria-label="Hour of forecast horizon" />
                <span className="num w-24 shrink-0 text-right text-[12px] font-semibold text-ink">{fmtDayHour(view.ts)}</span>
              </div>
              <FeederTable feeders={view.rows} />
            </Panel>
            <Panel
              title={mapView === 'map' ? 'Delhi area map' : 'Schematic map'}
              subtitle={mapView === 'map' ? 'OpenStreetMap basemap. Fill is allocated utilisation; DISCOM edges are approximate.' : 'Circle size is allocated load. Not a GIS map.'}
              actions={<Segmented size="sm" value={mapView} options={['map', 'schematic']} onChange={setMapView} labelOf={(v) => (v === 'map' ? 'Map' : 'Schematic')} />}
            >
              {mapView === 'map' ? <DelhiMap feeders={view.rows} /> : <AreaMap feeders={view.rows} />}
            </Panel>
          </div>

          <Panel title="Utilisation by area and hour" subtitle="Next 24 hours. Brighter = higher share of assumed area capacity; rings mark warning and critical.">
            <FeederHeatmap feeders={d.feeders} hourly={d.hourly} />
          </Panel>
        </>
      )}
    </div>
  )
}
