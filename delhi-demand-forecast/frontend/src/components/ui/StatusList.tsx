import { useAppState } from '../../hooks/useAppState.tsx'

type Light = 'good' | 'warning' | 'critical' | 'idle'

const DOT: Record<Light, string> = {
  good: 'bg-good dot-good',
  warning: 'bg-warning dot-warning',
  critical: 'bg-critical dot-critical',
  idle: 'bg-ink-3',
}

export function StatusDot({ light, pulse }: { light: Light; pulse?: boolean }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT[light]} ${pulse ? 'animate-pulse' : ''}`} aria-hidden />
}

export interface StatusRow { name: string; light: Light; text: string; pulse?: boolean }

/** Derives the subsystem rows from /api/status. Words carry the state, the
 *  dot only reinforces it. */
export function useSystemRows(): { overall: StatusRow; rows: StatusRow[] } {
  const { status, statusError } = useAppState()
  if (!status) {
    const light: Light = statusError ? 'critical' : 'idle'
    const text = statusError ? 'Offline' : 'Connecting'
    return {
      overall: { name: 'System status', light, text },
      rows: [
        { name: 'API', light, text: statusError ? 'Unreachable' : 'Connecting' },
        { name: 'Forecast engine', light: 'idle', text: 'Unknown' },
        { name: 'Weather', light: 'idle', text: 'Unknown' },
        { name: 'Model', light: 'idle', text: 'Unknown' },
      ],
    }
  }
  const model = status.model.status
  const weather = status.weather.source
  const rows: StatusRow[] = [
    { name: 'API', light: 'good', text: `Connected · v${status.version}` },
    { name: 'Forecast engine', light: status.forecast.method === 'ml_model' ? 'good' : 'warning', text: status.forecast.method === 'ml_model' ? 'Ready · ML model' : 'Ready · heuristic' },
    {
      name: 'Weather',
      light: weather === 'live' ? 'good' : 'warning',
      text: weather === 'live' ? 'Live (Open-Meteo)' : weather === 'cache' ? 'Cached' : weather === 'historical_analog' ? 'Historical analog' : 'Simulated',
    },
    {
      name: 'Model',
      light: model === 'loaded' ? 'good' : model === 'training' || model === 'loading' ? 'warning' : 'critical',
      text: model === 'loaded' ? 'Loaded' : model === 'training' ? 'Training' : model === 'loading' ? 'Loading' : model === 'failed' ? 'Failed' : 'Absent',
      pulse: model === 'training' || model === 'loading',
    },
  ]
  const degraded = rows.some((r) => r.light !== 'good')
  return {
    overall: { name: 'System status', light: degraded ? 'warning' : 'good', text: degraded ? 'Degraded' : 'Operational' },
    rows,
  }
}

/** Compact system status block. */
export default function StatusList({ dense }: { dense?: boolean }) {
  const { overall, rows } = useSystemRows()
  return (
    <div className={dense ? 'text-[11px]' : 'text-xs'}>
      <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
        <span className="label">System status</span>
        <span className="flex items-center gap-1.5 font-semibold text-ink"><StatusDot light={overall.light} />{overall.text}</span>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-2">
            <span className="text-ink-2">{r.name}</span>
            <span className="flex items-center gap-1.5 text-ink"><StatusDot light={r.light} pulse={r.pulse} />{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
