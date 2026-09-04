import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from '../services/api.ts'
import type { StatusResponse } from '../types/api.ts'

/** App-wide state: backend status (polled), the editable grid-capacity
 *  ASSUMPTION, and a version counter that bumps when the model finishes
 *  training so pages refetch model-based data. */
interface AppState {
  status: StatusResponse | null
  statusError: ApiError | null
  capacityMw: number
  setCapacityMw: (mw: number) => void
  defaultCapacityMw: number
  version: number
  refreshStatus: () => void
}

const Ctx = createContext<AppState | null>(null)
const STORAGE_KEY = 'peakwatch.capacity_mw'

function readStoredCapacity(): number | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [statusError, setStatusError] = useState<ApiError | null>(null)
  const [capacityOverride, setCapacityOverride] = useState<number | null>(readStoredCapacity)
  const [version, setVersion] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const poll = async () => {
      try {
        const s = await api.status()
        if (cancelled) return
        setStatus((prev) => {
          if (prev && prev.forecast.method !== s.forecast.method) setVersion((v) => v + 1)
          return s
        })
        setStatusError(null)
        // Poll fast while the demo model is training, slowly otherwise.
        timer = window.setTimeout(poll, s.model.status === 'training' ? 4_000 : 60_000)
      } catch (e) {
        if (cancelled) return
        setStatusError(e instanceof ApiError ? e : new ApiError(String(e), 'network', null))
        timer = window.setTimeout(poll, 8_000)
      }
    }
    poll()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [tick])

  const defaultCapacityMw = status?.assumptions.grid_capacity_mw ?? 9100
  const capacityMw = capacityOverride ?? defaultCapacityMw

  const setCapacityMw = useCallback(
    (mw: number) => {
      const next = Number.isFinite(mw) && mw > 0 ? Math.round(mw) : defaultCapacityMw
      setCapacityOverride(next === defaultCapacityMw ? null : next)
      try {
        if (next === defaultCapacityMw) localStorage.removeItem(STORAGE_KEY)
        else localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        /* storage unavailable: keep in memory only */
      }
    },
    [defaultCapacityMw],
  )

  const refreshStatus = useCallback(() => setTick((t) => t + 1), [])

  const value = useMemo<AppState>(
    () => ({ status, statusError, capacityMw, setCapacityMw, defaultCapacityMw, version, refreshStatus }),
    [status, statusError, capacityMw, setCapacityMw, defaultCapacityMw, version, refreshStatus],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider')
  return ctx
}
