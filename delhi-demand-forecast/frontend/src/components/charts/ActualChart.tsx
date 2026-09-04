import { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ActualPoint } from '../../types/api.ts'
import { fmtDateTime, fmtInt, fmtMW, fmtSigned, fmtTick } from '../../utils/format.ts'
import { C, axisLine, legendStyle, niceDomain, tickStyle } from './theme.ts'
import { TooltipBox, hoveredRow, type TipProps } from './ChartTooltip.tsx'

export default function ActualChart({ points, height = 240 }: { points: ActualPoint[]; height?: number }) {
  const domain = useMemo(() => {
    const v = points.flatMap((p) => [p.actual_mw, p.predicted_mw ?? NaN]).filter((x) => !Number.isNaN(x))
    return niceDomain(Math.min(...v), Math.max(...v))
  }, [points])
  const mae = useMemo(() => {
    const e = points.filter((p) => p.predicted_mw != null).map((p) => Math.abs(p.actual_mw - (p.predicted_mw as number)))
    return e.length ? e.reduce((a, b) => a + b, 0) / e.length : null
  }, [points])
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="ts" tickFormatter={fmtTick} tick={tickStyle} axisLine={axisLine} tickLine={false} interval={Math.max(0, Math.floor(points.length / 10) - 1)} />
          <YAxis domain={domain} tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtInt(v)} width={54} />
          <Tooltip
            cursor={{ stroke: C.tick, strokeDasharray: '3 3' }}
            content={(props: TipProps<ActualPoint>) => {
              const p = hoveredRow(props)
              if (!p) return null
              return (
                <TooltipBox
                  title={fmtDateTime(p.ts)}
                  rows={[
                    { label: 'Actual', value: fmtMW(p.actual_mw), color: C.actual },
                    { label: 'Predicted', value: fmtMW(p.predicted_mw), color: C.forecast },
                    { label: 'Error', value: p.predicted_mw != null ? fmtSigned(p.predicted_mw - p.actual_mw) : '–' },
                  ]}
                />
              )
            }}
          />
          <Legend verticalAlign="top" align="right" height={26} iconType="plainline" iconSize={14} wrapperStyle={legendStyle} />
          <Line type="monotone" dataKey="actual_mw" name="Actual" stroke={C.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="predicted_mw" name="Predicted (1 h ahead)" stroke={C.forecast} strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
      {mae != null && <p className="num mt-1 text-right text-[10.5px] text-ink-3">Mean absolute error over window: <span className="font-semibold text-ink-2">{fmtInt(mae)} MW</span></p>}
    </div>
  )
}
