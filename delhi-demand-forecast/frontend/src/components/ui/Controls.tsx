import { useEffect, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.tsx'
import { hoursLabel } from '../../utils/format.ts'

export function Segmented<T extends string | number>({
  value, options, onChange, labelOf,
}: { value: T; options: T[]; onChange: (v: T) => void; labelOf?: (v: T) => string }) {
  return (
    <div className="inline-flex rounded border border-line-strong bg-surface-2 p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={String(o)}
          role="tab"
          aria-selected={o === value}
          onClick={() => onChange(o)}
          className={`rounded px-2.5 py-1 text-xs font-semibold transition ${o === value ? 'bg-series-blue text-white' : 'text-ink-2 hover:text-ink'}`}
        >
          {labelOf ? labelOf(o) : String(o)}
        </button>
      ))}
    </div>
  )
}

export function HorizonSelector({ value, onChange, options = [24, 48, 168] }: { value: number; onChange: (h: number) => void; options?: number[] }) {
  return <Segmented value={value} options={options} onChange={onChange} labelOf={hoursLabel} />
}

/** Editable grid-capacity ASSUMPTION. Persisted locally, sent as capacity_mw. */
export function CapacityInput({ compact }: { compact?: boolean }) {
  const { capacityMw, setCapacityMw, defaultCapacityMw } = useAppState()
  const [draft, setDraft] = useState(String(capacityMw))
  useEffect(() => setDraft(String(capacityMw)), [capacityMw])
  const commit = () => setCapacityMw(Number(draft))
  return (
    <label className="flex items-center gap-2 text-xs text-ink-2">
      {!compact && <span className="whitespace-nowrap">Grid capacity</span>}
      <input
        type="number"
        min={1000}
        step={100}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className="num w-24 rounded border border-line-strong bg-surface-2 px-2 py-1 text-right text-xs font-semibold text-ink outline-none focus:border-series-blue"
        aria-label="Grid capacity assumption in MW"
      />
      <span>MW</span>
      {capacityMw !== defaultCapacityMw && (
        <button onClick={() => setCapacityMw(defaultCapacityMw)} className="text-[11px] text-series-blue hover:underline" title="Reset to configured default">
          reset
        </button>
      )}
    </label>
  )
}
