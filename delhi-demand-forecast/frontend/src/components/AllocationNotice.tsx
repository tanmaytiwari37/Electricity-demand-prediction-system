import { fmtPct } from '../utils/format.ts'

/** One quiet line stating that area figures are a proportional allocation of
 *  the system forecast, with the method behind a disclosure. Our load data is
 *  Delhi system-wide only; there is no feeder or DISCOM telemetry in it. */
export default function AllocationNotice({ shares, compact = false }: { shares?: Record<string, number>; compact?: boolean }) {
  const ratios = shares
    ? Object.entries(shares).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${fmtPct(v * 100, 0)}`).join(' · ')
    : null

  if (compact) {
    return <p className="mt-3 text-[11px] text-ink-3">Allocated from the system forecast by DISCOM share{ratios ? ` (${ratios})` : ''}. Not measured.</p>
  }

  return (
    <details className="group rounded-md border border-line bg-surface-1 px-5 py-3 text-[12px] text-ink-2">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span className="shrink-0 rounded-sm border border-warning/40 px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.1em] text-warning">SIMULATED FEEDER DATA</span>
        <span className="truncate">Every area figure is the system forecast split by DISCOM share. None of it is measured.</span>
        <span className="ml-auto shrink-0 text-[11px] text-ink-3 group-open:hidden">How it works ▸</span>
      </summary>
      <div className="mt-3 grid gap-x-8 gap-y-2 border-t border-line pt-3 leading-relaxed md:grid-cols-2">
        <p><b className="text-ink">Method.</b> Area load = system forecast × share. Area capacity = grid-capacity assumption × share × a headroom factor. Status is the ratio of the two.</p>
        {ratios && <p><b className="text-ink">Shares.</b> <span className="num">{ratios}</span>.</p>}
        <p><b className="text-ink">Source.</b> Published May 2026 DISCOM peaks (BRPL 3,762 MW, BYPL 1,838 MW, TPDDL 2,331 MW) against a system peak near 8,231 MW, normalised to 100%. Non-coincident peaks, so the shares are approximate upper bounds.</p>
        <p><b className="text-ink">With real feeder data</b> these ratios would be replaced by measured area loads and alerts could point at a specific feeder.</p>
      </div>
    </details>
  )
}
