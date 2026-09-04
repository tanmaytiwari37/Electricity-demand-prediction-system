import { CartesianGrid, ReferenceArea, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import type { WeatherImpactResponse } from '../../types/api.ts'
import { fmtInt, fmtMW } from '../../utils/format.ts'
import { C, axisLine, tickStyle } from './theme.ts'
import { TooltipBox, hoveredRow, type TipProps } from './ChartTooltip.tsx'

type Pt = WeatherImpactResponse['scatter'][number]

export default function WeatherScatter({ data, comfort, height = 320 }: { data: Pt[]; comfort: [number, number]; height?: number }) {
  const loads = data.map((d) => d.avg_load_mw)
  const lo = Math.floor((Math.min(...loads) - 300) / 500) * 500
  const hi = Math.ceil((Math.max(...loads) + 300) / 500) * 500
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={C.grid} />
        <XAxis type="number" dataKey="temp_c" name="Temperature" unit="°C" domain={['dataMin - 2', 'dataMax + 2']} tick={tickStyle} axisLine={axisLine} tickLine={false} />
        <YAxis type="number" dataKey="avg_load_mw" name="Average load" domain={[lo, hi]} tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtInt(v)} width={54} />
        <ZAxis type="number" dataKey="n_hours" range={[40, 400]} />
        <ReferenceArea x1={comfort[0]} x2={comfort[1]} fill={C.ink2} fillOpacity={0.06} label={{ value: 'comfort band', fill: C.tick, fontSize: 10, position: 'insideTop' }} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3', stroke: C.tick }}
          content={(props: TipProps<Pt>) => {
            const p = hoveredRow(props)
            if (!p) return null
            return <TooltipBox title={`${p.temp_c.toFixed(0)} °C bin`} rows={[{ label: 'Average load', value: fmtMW(p.avg_load_mw), color: C.forecast }, { label: 'Hours in bin', value: fmtInt(p.n_hours) }]} />
          }}
        />
        <Scatter data={data} fill={C.forecast} fillOpacity={0.85} stroke={C.surface} strokeWidth={1.5} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
