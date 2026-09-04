import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FeatureImportance } from '../../types/api.ts'
import { fmtInt } from '../../utils/format.ts'
import { C, tickStyle } from './theme.ts'
import { TooltipBox, hoveredRow, type TipProps } from './ChartTooltip.tsx'

/** Permutation importance: MAE increase when a feature is shuffled. One
 *  series, one colour; direct labels carry the values. */
export default function ImportanceChart({ items, top = 10 }: { items: FeatureImportance[]; top?: number }) {
  const data = items.slice(0, top).map((d) => ({ ...d, v: Math.max(0, d.importance_mae) }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }} barCategoryGap={6}>
        <CartesianGrid stroke={C.grid} horizontal={false} />
        <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtInt(v)} />
        <YAxis type="category" dataKey="label" width={190} tick={{ ...tickStyle, fill: C.ink2 }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: C.grid, fillOpacity: 0.4 }}
          content={(props: TipProps<(typeof data)[number]>) => {
            const p = hoveredRow(props)
            return p ? <TooltipBox title={p.label} rows={[{ label: 'MAE increase when shuffled', value: `${fmtInt(p.importance_mae)} ± ${fmtInt(p.std)} MW` }]} /> : null
          }}
        />
        <Bar dataKey="v" fill={C.forecast} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
          <LabelList dataKey="v" position="right" formatter={(v: unknown) => `${fmtInt(Number(v))} MW`} style={{ fill: C.ink2, fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
