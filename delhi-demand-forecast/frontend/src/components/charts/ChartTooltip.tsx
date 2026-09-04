import type { ReactNode } from 'react'

/** Props Recharts hands to a custom tooltip `content` function (payload is readonly). */
export interface TipProps<T> {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: T }>
}

/** The hovered row, or null when the tooltip is inactive. */
export function hoveredRow<T>({ active, payload }: TipProps<T>): T | null {
  if (!active || !payload?.length) return null
  return payload[0].payload ?? null
}

export interface TooltipRow {
  label: string
  value: ReactNode
  color?: string
}

/** Shared tooltip chrome: title, then rows with a colour swatch. Text always
 *  uses ink tokens; the swatch carries series identity. */
export function TooltipBox({ title, rows }: { title: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="rounded border border-line-strong bg-surface-2/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="mb-1 font-semibold text-ink">{title}</div>
      <table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="pr-2 text-ink-2">
                {r.color && <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: r.color }} />}
                {r.label}
              </td>
              <td className="num text-right font-semibold text-ink">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
