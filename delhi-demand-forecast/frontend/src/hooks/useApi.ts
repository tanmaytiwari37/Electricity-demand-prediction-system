import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../services/api.ts'

export interface ApiState<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
  refetch: () => void
}

/** Runs an API call, tracks loading/error, aborts stale requests, and keeps
 *  the previous data visible while a refetch is in flight. */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: unknown[]): ApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [tick, setTick] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    fetcherRef
      .current(controller.signal)
      .then((d) => {
        if (!active) return
        setData(d)
        setError(null)
      })
      .catch((e) => {
        if (!active || controller.signal.aborted) return
        setError(e instanceof ApiError ? e : new ApiError(String(e), 'network', null))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const refetch = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, refetch }
}
