import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAppState } from '../../hooks/useAppState.tsx'
import { fmtClock, fmtDate, fmtInt, fmtLongDate } from '../../utils/format.ts'
import { sourceWord } from '../ui/Badges.tsx'
import { CapacityInput } from '../ui/Controls.tsx'
import { IconAlerts, IconAreas, IconClose, IconForecast, IconHome, IconMenu, IconModel, IconOverview, IconScenario, IconWeather, Logo } from '../ui/Icons.tsx'
import StatusList, { StatusDot, useSystemRows } from '../ui/StatusList.tsx'

const NAV = [
  { to: '/overview', label: 'Overview', icon: IconOverview },
  { to: '/forecast', label: 'Forecast', icon: IconForecast },
  { to: '/alerts', label: 'Alerts', icon: IconAlerts },
  { to: '/areas', label: 'Areas', icon: IconAreas },
  { to: '/weather', label: 'Weather Impact', icon: IconWeather },
  { to: '/scenario', label: 'What-if', icon: IconScenario },
  { to: '/model', label: 'Model', icon: IconModel },
]

const TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/forecast': 'Demand Forecast',
  '/alerts': 'Grid Alerts',
  '/areas': 'Area Intelligence',
  '/weather': 'Weather Impact',
  '/scenario': 'Scenario Simulator',
  '/model': 'Model Intelligence',
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { status, statusError, capacityMw } = useAppState()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const now = useClock()
  const { overall } = useSystemRows()
  const title = TITLES[pathname] ?? 'Overview'
  const demo = status?.history.source === 'demo'

  const modelVersion = status
    ? status.model.loaded && status.model.name
      ? `${status.model.name}${status.model.trained_at ? ` · ${fmtDate(status.model.trained_at)}` : ''}`
      : status.model.status === 'training'
        ? 'training…'
        : 'heuristic (no model)'
    : '–'

  return (
    <div className="flex min-h-screen bg-surface-0">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[228px] flex-col border-r border-line bg-surface-0 transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Primary navigation"
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
          <Link to="/" className="pressable rounded-[4px]" title="Front page"><Logo size={28} /></Link>
          <div className="min-w-0 leading-tight">
            <div className="text-[13px] font-extrabold tracking-[0.18em] text-ink">PEAKWATCH</div>
            <div className="truncate text-[9.5px] uppercase tracking-[0.14em] text-ink-3">Delhi grid intelligence</div>
          </div>
          <button className="ml-auto text-ink-3 hover:text-ink lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><IconClose size={16} /></button>
        </div>

        <nav className="flex flex-col gap-px p-2">
          <Link to="/" onClick={() => setOpen(false)} className="pressable mb-1 inline-flex w-fit items-center gap-1.5 rounded-[4px] border border-line bg-surface-1 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-2 hover:border-line-strong hover:text-ink">
            <IconHome size={12} />Home
          </Link>
          {NAV.map((n) => {
            const Icon = n.icon
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `pressable flex items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-[12.5px] ${isActive ? 'bg-surface-2 font-semibold text-ink shadow-[inset_2px_0_0_0_#f4f4f5]' : 'font-medium text-ink-2 hover:bg-surface-1 hover:text-ink'}`
                }
              >
                <Icon size={15} />
                {n.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-line p-4 text-[11px]">
          <div className="flex flex-col gap-0.5">
            <span className="label">System status</span>
            <span className="flex items-center gap-1.5 font-semibold text-ink"><StatusDot light={overall.light} />{overall.text}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="label">Data source</span>
            <span className="font-semibold text-ink">{status ? sourceWord(status.history.source, status.weather.source) : statusError ? 'OFFLINE' : '…'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="label">Model version</span>
            <span className="num truncate font-semibold text-ink" title={modelVersion}>{modelVersion}</span>
          </div>
          <details className="group">
            <summary className="cursor-pointer list-none text-[10.5px] text-ink-3 hover:text-ink-2">Subsystems ▸</summary>
            <div className="mt-2 rounded-[4px] border border-line bg-surface-1 p-3"><StatusList dense /></div>
          </details>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-black/70 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-line bg-surface-0/95 px-4 backdrop-blur lg:px-6">
          <button className="pressable rounded-[4px] border border-line-strong p-1.5 text-ink-2 hover:text-ink lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><IconMenu size={16} /></button>
          <Link to="/" className="pressable inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-line bg-surface-1 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-2 hover:border-line-strong hover:text-ink" title="Front page">
            <IconHome size={12} />Home
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-[-0.01em] text-ink">{title}</h1>
            <div className="hidden text-[10.5px] uppercase tracking-[0.12em] text-ink-3 sm:block">Delhi Grid Intelligence</div>
          </div>

          <div className="ml-auto flex items-center gap-4 lg:gap-6">
            {demo && (
              <span className="hidden items-center gap-1.5 rounded-[4px] border border-warning/40 bg-warning/8 px-2 py-1 text-[10px] font-bold tracking-[0.1em] text-warning md:inline-flex" title="Bundled synthetic history is being served. Not real Delhi load data.">
                DEMO MODE
              </span>
            )}
            <HeaderStat label="System">
              <span className="flex items-center gap-1.5"><StatusDot light={overall.light} />{statusError ? 'Offline' : status ? overall.text : 'Connecting'}</span>
            </HeaderStat>
            <HeaderStat label="Data source" hide="md">
              <span>{status ? sourceWord(status.history.source, status.weather.source) : '–'}</span>
            </HeaderStat>
            <HeaderStat label="Grid capacity" hide="md-xl">
              <span className="num">{fmtInt(capacityMw)} MW</span>
            </HeaderStat>
            <div className="hidden xl:block"><CapacityInput /></div>
            <HeaderStat label={fmtLongDate(now)} hide="sm">
              <span className="num font-mono text-xs">{fmtClock(now)} IST</span>
            </HeaderStat>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
        <footer className="border-t border-line px-4 py-2 text-[10px] text-ink-3 lg:px-6">
          PEAKWATCH · Predict the peak. Prevent the risk. · Decision support only, not an operational instruction.
        </footer>
      </div>
    </div>
  )
}

function HeaderStat({ label, children, hide }: { label: string; children: ReactNode; hide?: 'sm' | 'md' | 'md-xl' }) {
  const vis = hide === 'md' ? 'hidden md:flex' : hide === 'md-xl' ? 'hidden md:flex xl:hidden' : hide === 'sm' ? 'hidden sm:flex' : 'flex'
  return (
    <div className={`${vis} flex-col items-end leading-tight`}>
      <span className="text-[9.5px] uppercase tracking-[0.12em] text-ink-3">{label}</span>
      <span className="text-xs font-semibold text-ink">{children}</span>
    </div>
  )
}
