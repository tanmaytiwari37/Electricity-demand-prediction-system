import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WhatIfPoint } from '../../types/api.ts'
import { fmtDateTime, fmtInt, fmtMW, fmtSigned, fmtTick } from '../../utils/format.ts'
import { C, axisLine, niceDomain, tickStyle } from './theme.ts'
import { TooltipBox, hoveredRow, type TipProps } from './ChartTooltip.tsx'

export default function ScenarioChart({ points, capacityMw, height = 300 }: { points: WhatIfPoint[]; capacityMw: number; height?: number }) {
  const domain = useMemo(() => {
    const v = points.flatMap((p) => [p.baseline_mw, p.scenario_mw])
    return niceDomain(Math.min(...v), Math.max(...v), capacityMw)
  }, [points, capacityMw])
  const hasSolar = points.some((p) => p.solar_gen_mw > 0)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="ts" tickFormatter={fmtTick} tick={tickStyle} axisLine={axisLine} tickLine={false} interval={Math.max(0, Math.floor(points.length / 12) - 1)} />
        <YAxis domain={domain} tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtInt(v)} width={54} />
        <Tooltip
          cursor={{ stroke: C.axis, strokeDasharray: '3 3' }}
          content={(props: TipProps<WhatIfPoint>) => {
            const p = hoveredRow(props)
            if (!p) return null
            return (
              <TooltipBox
                title={fmtDateTime(p.ts)}
                rows={[
                  { label: 'Baseline', value: fmtMW(p.baseline_mw), color: C.forecast },
                  { label: 'Scenario', value: fmtMW(p.scenario_mw), color: C.scenario },
                  { label: 'Temperature effect', value: fmtSigned(p.temp_effect_mw) },
                  { label: 'Rooftop solar', value: fmtSigned(-p.solar_gen_mw), color: C.solar },
                ]}
              />
            )
          }}
        />
        <Legend verticalAlign="top" align="right" height={24} iconType="plainline" wrapperStyle={{ fontSize: 11, color: C.ink2 }} />
        {hasSolar && <Area type="monotone" dataKey="solar_gen_mw" name="Rooftop solar (MW)" stroke={C.solar} strokeWidth={1.5} fill={C.solar} fillOpacity={0.12} dot={false} isAnimationActive={false} legendType="rect" />}
        <Line type="monotone" dataKey="baseline_mw" name="Baseline forecast" stroke={C.forecast} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="scenario_mw" name="Scenario" stroke={C.scenario} strokeWidth={2} dot={false} isAnimationActive={false} />
        <ReferenceLine y={capacityMw} stroke={C.critical} strokeDasharray="6 4" label={{ value: `Capacity ${fmtInt(capacityMw)} MW`, position: 'insideTopRight', fill: C.critical, fontSize: 11 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
