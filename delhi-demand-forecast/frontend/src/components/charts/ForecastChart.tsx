import { useMemo, useState } from 'react'
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { ActualPoint, ForecastPoint } from '../../types/api.ts'
import { fmtDateTime, fmtInt, fmtMW, fmtTemp, fmtTick } from '../../utils/format.ts'
import { C, axisLine, niceDomain, tickStyle } from './theme.ts'
import { TooltipBox, hoveredRow, type TipProps } from './ChartTooltip.tsx'

interface Row {
  ts: string
  actual: number | null
  predicted: number | null
  band: [number, number] | null
  temp: number | null
  future: boolean
}

interface Props {
  forecast: ForecastPoint[]
  actual?: ActualPoint[]
  capacityMw: number
  peakTs?: string
  originTs?: string
  height?: number
  intervalLabel?: string
}

function TooltipContent(props: TipProps<Row>) {
  const r = hoveredRow(props)
  if (!r) return null
  const rows = []
  if (r.actual != null) rows.push({ label: 'Actual', value: fmtMW(r.actual), color: C.actual })
  if (r.predicted != null) rows.push({ label: r.future ? 'Forecast' : 'Backtest', value: fmtMW(r.predicted), color: C.forecast })
  if (r.band) rows.push({ label: 'Range', value: `${fmtInt(r.band[0])} – ${fmtInt(r.band[1])} MW` })
  if (r.temp != null) rows.push({ label: 'Temperature', value: fmtTemp(r.temp) })
  return <TooltipBox title={fmtDateTime(r.ts)} rows={rows} />
}

export default function ForecastChart({ forecast, actual = [], capacityMw, peakTs, originTs, height = 320, intervalLabel }: Props) {
  const [table, setTable] = useState(false)
  const data = useMemo<Row[]>(() => {
    const hist: Row[] = actual.map((p) => ({ ts: p.ts, actual: p.actual_mw, predicted: p.predicted_mw, band: null, temp: p.temp_c, future: false }))
    const fut: Row[] = forecast.map((p) => ({ ts: p.ts, actual: null, predicted: p.predicted_mw, band: [p.lower_mw, p.upper_mw], temp: p.temp_c, future: true }))
    return [...hist, ...fut]
  }, [forecast, actual])

  const domain = useMemo(() => {
    const vals = data.flatMap((r) => [r.actual ?? NaN, r.predicted ?? NaN, r.band?.[0] ?? NaN, r.band?.[1] ?? NaN]).filter((v) => !Number.isNaN(v))
    return niceDomain(Math.min(...vals), Math.max(...vals), capacityMw)
  }, [data, capacityMw])

  const peak = peakTs ? forecast.find((p) => p.ts === peakTs) : undefined
  const nowTs = originTs ?? actual[actual.length - 1]?.ts
  const tickInterval = Math.max(0, Math.floor(data.length / 12) - 1)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-3">{intervalLabel}</span>
        <button onClick={() => setTable((t) => !t)} className="text-[11px] text-series-blue hover:underline">
          {table ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {table ? (
        <div className="max-h-80 overflow-auto scroll-thin rounded border border-line">
          <table className="num w-full text-xs">
            <thead className="sticky top-0 bg-surface-2 text-left text-ink-2">
              <tr><th className="p-2">Time (IST)</th><th className="p-2 text-right">Actual</th><th className="p-2 text-right">Forecast</th><th className="p-2 text-right">Low</th><th className="p-2 text-right">High</th><th className="p-2 text-right">Temp</th></tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.ts} className="border-t border-line">
                  <td className="p-2">{fmtDateTime(r.ts)}</td>
                  <td className="p-2 text-right">{fmtInt(r.actual)}</td>
                  <td className="p-2 text-right">{fmtInt(r.predicted)}</td>
                  <td className="p-2 text-right">{r.band ? fmtInt(r.band[0]) : '–'}</td>
                  <td className="p-2 text-right">{r.band ? fmtInt(r.band[1]) : '–'}</td>
                  <td className="p-2 text-right">{r.temp?.toFixed(1) ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="ts" tickFormatter={fmtTick} tick={tickStyle} axisLine={axisLine} tickLine={false} interval={tickInterval} minTickGap={24} />
            <YAxis domain={domain} tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtInt(v)} width={54} />
            <Tooltip content={<TooltipContent />} cursor={{ stroke: C.axis, strokeDasharray: '3 3' }} />
            <Legend verticalAlign="top" align="right" height={24} iconType="plainline" wrapperStyle={{ fontSize: 11, color: C.ink2 }} />
            <Area type="monotone" dataKey="band" name="P10–P90 band" stroke="none" fill={C.forecast} fillOpacity={0.12} connectNulls={false} isAnimationActive={false} legendType="rect" />
            <Line type="monotone" dataKey="actual" name="Actual" stroke={C.actual} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="predicted" name="Forecast" stroke={C.forecast} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            <ReferenceLine y={capacityMw} stroke={C.critical} strokeDasharray="6 4" label={{ value: `Capacity ${fmtInt(capacityMw)} MW`, position: 'insideTopRight', fill: C.critical, fontSize: 11 }} />
            {nowTs && <ReferenceLine x={nowTs} stroke={C.axis} label={{ value: 'now', position: 'insideTopLeft', fill: C.tick, fontSize: 10 }} />}
            {peak && (
              <ReferenceDot x={peak.ts} y={peak.predicted_mw} r={6} fill={C.forecast} stroke={C.surface} strokeWidth={2}
                label={{ value: `Peak ${fmtInt(peak.predicted_mw)} MW`, position: 'top', fill: C.ink, fontSize: 11, fontWeight: 600 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
