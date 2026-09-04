import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAppState } from '../../hooks/useAppState.tsx'
import { fmtDateTime } from '../../utils/format.ts'
import { Badge, historyKind, methodKind, weatherKind } from '../ui/Badges.tsx'
import { CapacityInput } from '../ui/Controls.tsx'

const NAV = [
  { to: '/', label: 'Overview', hint: 'Peak, risk, headroom' },
  { to: '/forecast', label: 'Forecast', hint: '24 h and 7 d demand' },
  { to: '/alerts', label: 'Alerts', hint: 'Capacity risk windows' },
  { to: '/areas', label: 'Areas', hint: 'DISCOM utilisation' },
  { to: '/weather', label: 'Weather impact', hint: 'Temperature vs load' },
  { to: '/scenario', label: 'What-if', hint: 'Heat and rooftop solar' },
  { to: '/model', label: 'Model', hint: 'Accuracy and drivers' },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const { status, statusError } = useAppState()
  const [open, setOpen] = useState(false)
  const online = !!status && !statusError

  return (
    <div className="flex min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-30 w-60 border-r border-line bg-surface-1 transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <span className="grid h-7 w-7 place-items-center rounded bg-series-blue/20 text-series-blue">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l5-7 3 3 5-8 5 6" /></svg>
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide">PeakWatch Delhi</div>
            <div className="text-[10px] uppercase tracking-widest text-ink-3">Demand intelligence</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm transition ${isActive ? 'bg-series-blue/15 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`
              }
            >
              <div className="font-semibold">{n.label}</div>
              <div className="text-[11px] text-ink-3">{n.hint}</div>
            </NavLink>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-line p-3 text-[11px] text-ink-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-good' : 'bg-critical'}`} />
            {online ? `API v${status.version}` : 'API offline'}
          </div>
          {status && <div className="mt-1">As of {fmtDateTime(status.as_of)}</div>}
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-surface-0/95 px-4 backdrop-blur">
          <button className="rounded border border-line-strong px-2 py-1 text-xs lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            Menu
          </button>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-x-auto scroll-thin">
            {status ? (
              <>
                <Badge kind={historyKind(status.history.source)} />
                <Badge kind={methodKind(status.forecast.method)} />
                <Badge kind={weatherKind(status.weather.source)} />
                {status.model.status === 'training' && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-2">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-series-blue" /> training demo model…
                  </span>
                )}
              </>
            ) : statusError ? (
              <span className="text-xs text-critical">{statusError.message}</span>
            ) : (
              <span className="text-xs text-ink-3">Connecting to API…</span>
            )}
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Badge kind="assumption" small />
            <CapacityInput />
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
