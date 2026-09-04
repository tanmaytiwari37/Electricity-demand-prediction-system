import { Area, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtDateTime, fmtTemp, fmtTick } from '../../utils/format.ts'
import { C, tickStyle } from './theme.ts'
import { TooltipBox, hoveredRow, type TipProps } from './ChartTooltip.tsx'

interface Row { ts: string; temp: number | null }

/** Temperature on its own axis (never a second y-axis on the demand chart). */
export default function TemperatureStrip({ rows, height = 90 }: { rows: Row[]; height?: number }) {
  const vals = rows.map((r) => r.temp).filter((v): v is number => v != null)
  if (!vals.length) return null
  const lo = Math.floor(Math.min(...vals) - 2)
  const hi = Math.ceil(Math.max(...vals) + 2)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <XAxis dataKey="ts" tickFormatter={fmtTick} tick={tickStyle} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(rows.length / 12) - 1)} />
        <YAxis domain={[lo, hi]} tick={tickStyle} axisLine={false} tickLine={false} width={54} tickFormatter={(v: number) => `${v}°`} />
        <Tooltip
          content={(props: TipProps<Row>) => {
            const p = hoveredRow(props)
            return p ? <TooltipBox title={fmtDateTime(p.ts)} rows={[{ label: 'Temperature', value: fmtTemp(p.temp), color: C.magenta }]} /> : null
          }}
        />
        <Area type="monotone" dataKey="temp" stroke={C.magenta} strokeWidth={2} fill={C.magenta} fillOpacity={0.1} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
