import { useMemo, useState } from 'react'
import type { Feeder } from '../types/api.ts'
import { feederMeta, fmtInt, fmtPct } from '../utils/format.ts'
import { StatusPill } from './ui/Badges.tsx'

const BAR = { ok: 'bg-ink-2', warning: 'bg-warning', critical: 'bg-critical' }

type SortKey = 'name' | 'discom' | 'predicted_mw' | 'capacity_mw' | 'utilization_pct'
interface Sort { key: SortKey; dir: 1 | -1 }

function SortHeader({ k, sort, onToggle, right, children }: { k: SortKey; sort: Sort; onToggle: (k: SortKey) => void; right?: boolean; children: string }) {
  const active = sort.key === k
  return (
    <th className={`pb-2 ${right ? 'text-right' : 'text-left'}`}>
      <button onClick={() => onToggle(k)} className={`label inline-flex items-center gap-1 hover:!text-ink ${active ? '!text-ink' : ''}`} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
        {children}<span aria-hidden className="w-2 text-[8px]">{active ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  )
}

/** Area ledger, sortable by column. */
export default function FeederTable({ feeders, compact = false }: { feeders: Feeder[]; compact?: boolean }) {
  const [sort, setSort] = useState<Sort>({ key: 'utilization_pct', dir: -1 })
  const sorted = useMemo(() => {
    const rows = [...feeders]
    rows.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key]
      const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return c * sort.dir
    })
    return rows
  }, [feeders, sort])
  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' || key === 'discom' ? 1 : -1 }))

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            <SortHeader k="name" sort={sort} onToggle={toggle}>Area</SortHeader>
            <SortHeader k="discom" sort={sort} onToggle={toggle}>DISCOM</SortHeader>
            <SortHeader k="predicted_mw" sort={sort} onToggle={toggle} right>Predicted load</SortHeader>
            {!compact && <SortHeader k="capacity_mw" sort={sort} onToggle={toggle} right>Capacity</SortHeader>}
            <SortHeader k="utilization_pct" sort={sort} onToggle={toggle} right>Utilization</SortHeader>
            <th className="label pb-2 pl-4 text-left">Risk</th>
          </tr>
        </thead>
        <tbody className="num">
          {sorted.map((f) => (
            <tr key={f.id} className="border-t border-line">
              <td className="py-3 pr-3 font-semibold text-ink">{f.name.replace(/\s*\(.*\)$/, '')}</td>
              <td className="py-3 pr-3 text-ink-2">{f.discom}</td>
              <td className="py-3 pr-3 text-right font-semibold text-ink">{fmtInt(f.predicted_mw)} MW</td>
              {!compact && <td className="py-3 pr-3 text-right text-ink-2">{fmtInt(f.capacity_mw)} MW</td>}
              <td className="py-3 pr-3">
                <div className="flex items-center justify-end gap-3">
                  <div className="h-1.5 w-20 overflow-hidden rounded-sm bg-surface-3" role="meter" aria-valuenow={f.utilization_pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${f.name} allocated utilisation`}>
                    <div className={`h-full rounded-sm ${BAR[f.status]}`} style={{ width: `${Math.min(100, f.utilization_pct)}%` }} />
                  </div>
                  <span className={`w-12 text-right font-semibold ${feederMeta[f.status].text}`}>{fmtPct(f.utilization_pct)}</span>
                </div>
              </td>
              <td className="py-3 pl-4"><StatusPill status={f.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
