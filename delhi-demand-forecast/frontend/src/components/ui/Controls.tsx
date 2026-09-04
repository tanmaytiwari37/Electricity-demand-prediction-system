import { useEffect, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.tsx'


export function Segmented<T extends string | number>({
  value, options, onChange, labelOf, size = 'md',
}: { value: T; options: T[]; onChange: (v: T) => void; labelOf?: (v: T) => string; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex rounded-[4px] border border-line-strong bg-surface-2 p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={String(o)}
          role="tab"
          aria-selected={o === value}
          onClick={() => onChange(o)}
          className={`pressable rounded-[3px] font-semibold tracking-wide ${size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-[11px]'} ${o === value ? 'bg-ink text-surface-0' : 'text-ink-2 hover:bg-surface-3 hover:text-ink'}`}
        >
          {labelOf ? labelOf(o) : String(o)}
        </button>
      ))}
    </div>
  )
}

export function HorizonSelector({ value, onChange, options = [24, 48, 168] }: { value: number; onChange: (h: number) => void; options?: number[] }) {
  return <Segmented value={value} options={options} onChange={onChange} labelOf={(h) => (h >= 48 && h % 24 === 0 ? `${h / 24}D` : `${h}H`)} />
}

/** Editable grid-capacity ASSUMPTION. Persisted locally, sent as capacity_mw. */
export function CapacityInput({ compact }: { compact?: boolean }) {
  const { capacityMw, setCapacityMw, defaultCapacityMw } = useAppState()
  const [draft, setDraft] = useState(String(capacityMw))
  useEffect(() => setDraft(String(capacityMw)), [capacityMw])
  const commit = () => setCapacityMw(Number(draft))
  return (
    <label className="flex items-center gap-2 text-[11px] text-ink-2">
      {!compact && <span className="label whitespace-nowrap">Grid capacity</span>}
      <span className="flex items-center rounded-[4px] border border-line-strong bg-surface-2 focus-within:border-ink-3">
        <input
          type="number"
          min={1000}
          step={100}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="num w-[68px] bg-transparent py-1 pl-2 text-right text-xs font-semibold text-ink outline-none"
          aria-label="Grid capacity planning assumption in MW (configurable, not a measured limit)"
        />
        <span className="pr-2 pl-1 text-[10px] font-semibold text-ink-3">MW</span>
      </span>
      {capacityMw !== defaultCapacityMw && (
        <button onClick={() => setCapacityMw(defaultCapacityMw)} className="pressable text-[10.5px] font-semibold text-ink-2 hover:text-ink" title="Reset to configured default">
          reset
        </button>
      )}
    </label>
  )
}

/** Labelled range slider with the current value on the right and tick
 *  captions beneath. Interaction feedback lives in the CSS thumb only. */
export function Slider({ label, value, min, max, step, onChange, format, marks, hint }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; format: (v: number) => string; marks: string[]; hint?: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="label">{label}</span>
        <span className="num text-sm font-bold text-ink">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      <div className="num flex justify-between text-[10px] text-ink-3">{marks.map((m) => <span key={m}>{m}</span>)}</div>
      {hint && <p className="mt-1 text-[10.5px] leading-relaxed text-ink-3">{hint}</p>}
    </div>
  )
}
