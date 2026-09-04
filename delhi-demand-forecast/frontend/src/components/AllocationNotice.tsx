import { fmtPct } from '../utils/format.ts'

/** Explains, next to every area/DISCOM figure, that the numbers are a
 *  proportional allocation of the system-level forecast and not measurements.
 *  Our load data is Delhi system-wide only (region = "Delhi" on every row);
 *  there is no feeder or DISCOM telemetry anywhere in it. */
export default function AllocationNotice({ shares, compact = false }: { shares?: Record<string, number>; compact?: boolean }) {
  const ratios = shares
    ? Object.entries(shares)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${fmtPct(v * 100, 0)}`)
        .join(' · ')
    : null

  if (compact) {
    return (
      <p className="mt-3 border-t border-dashed border-series-magenta/40 pt-2 text-[11px] leading-relaxed text-ink-3">
        <span className="font-semibold text-series-magenta">≈ Proportional allocation, not measurement.</span> System forecast × configured DISCOM share
        {ratios && <> ({ratios})</>}. Shares come from published May 2026 DISCOM peaks that are non-coincident with the system peak, so they are approximate upper bounds. Our data has no feeder or DISCOM measurement.
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-dashed border-series-magenta/60 bg-series-magenta/5 px-4 py-3 text-xs leading-relaxed text-ink-2">
      <p className="font-semibold text-series-magenta">≈ Every figure on this page is a proportional allocation of the system-level forecast. None of it is measured.</p>
      <p className="mt-1">
        <span className="font-semibold text-ink">Method.</span> Area load = system forecast × DISCOM share. Area capacity = grid-capacity assumption × share × an assumed headroom factor. Status is the ratio of the two.
      </p>
      {ratios && (
        <p className="mt-1">
          <span className="font-semibold text-ink">Share ratios.</span> <span className="num">{ratios}</span> of system demand.
        </p>
      )}
      <p className="mt-1">
        <span className="font-semibold text-ink">Source.</span> Published May 2026 peaks: BRPL 3,762 MW, BYPL 1,838 MW, TPDDL 2,331 MW against a system peak near 8,231 MW, normalised to sum to 100% with NDMC and MES sharing the 300 MW residual. Each figure is that DISCOM's own peak, not its load at the system peak hour, so the shares are approximate upper bounds. Set in backend config, editable. Not derived from our data: the load history is Delhi system-wide only, with no feeder or DISCOM measurement on any row.
      </p>
      <p className="mt-1">
        <span className="font-semibold text-ink">With real feeder data.</span> Feeder or DISCOM telemetry would replace these ratios with measured area loads, allow area-specific forecasts and peak timing, and let an alert point at a specific feeder or transformer instead of the whole system.
      </p>
    </div>
  )
}
