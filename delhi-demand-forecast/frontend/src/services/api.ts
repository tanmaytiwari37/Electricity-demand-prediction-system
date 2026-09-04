/** Centralised API client. Every call goes through here so timeouts, error
 *  shaping and the base URL live in one place. */

import axios, { AxiosError } from 'axios'
import type {
  ActualResponse,
  AlertsResponse,
  FeedersResponse,
  ForecastResponse,
  Health,
  ModelCard,
  StatusResponse,
  WeatherImpactResponse,
  WhatIfRequest,
  WhatIfResponse,
} from '../types/api.ts'

/** Production: VITE_API_BASE (e.g. https://peakwatch-api.onrender.com). Local dev: leave it
 *  unset and the Vite proxy forwards /api to http://localhost:8000. VITE_API_URL is
 *  accepted as a legacy alias. */
const env = import.meta.env as Record<string, string | undefined>
export const API_BASE = (env.VITE_API_BASE || env.VITE_API_URL || '').replace(/\/$/, '')

const http = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 20_000,
  headers: { Accept: 'application/json' },
})

export class ApiError extends Error {
  status: number | null
  kind: 'timeout' | 'network' | 'http'
  constructor(message: string, kind: ApiError['kind'], status: number | null) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

function toApiError(err: unknown): ApiError {
  const e = err as AxiosError<{ detail?: unknown }>
  if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
    return new ApiError('The API did not respond in time.', 'timeout', null)
  }
  if (e.response) {
    const detail = e.response.data?.detail
    const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? 'Invalid request parameters.' : `API error ${e.response.status}`
    return new ApiError(msg, 'http', e.response.status)
  }
  const where = API_BASE ? `at ${API_BASE}` : 'through the local proxy (is the backend running on port 8000?)'
  return new ApiError(`Cannot reach the API ${where}. A free-tier backend can take up to a minute to wake up; retry shortly.`, 'network', null)
}

async function get<T>(path: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  try {
    const r = await http.get<T>(path, { params, signal })
    return r.data
  } catch (err) {
    throw toApiError(err)
  }
}

export const api = {
  health: (signal?: AbortSignal) => get<Health>('/health', undefined, signal),
  status: (signal?: AbortSignal) => get<StatusResponse>('/status', undefined, signal),
  model: (signal?: AbortSignal) => get<ModelCard>('/model', undefined, signal),
  forecast: (horizon: number, capacityMw?: number, signal?: AbortSignal) =>
    get<ForecastResponse>('/forecast', { horizon, capacity_mw: capacityMw }, signal),
  actual: (hours: number, signal?: AbortSignal) => get<ActualResponse>('/actual', { hours }, signal),
  alerts: (horizon: number, capacityMw?: number, signal?: AbortSignal) =>
    get<AlertsResponse>('/alerts', { horizon, capacity_mw: capacityMw }, signal),
  feeders: (opts: { ts?: string; horizon?: number; capacityMw?: number }, signal?: AbortSignal) =>
    get<FeedersResponse>('/feeders', { ts: opts.ts, horizon: opts.horizon, capacity_mw: opts.capacityMw }, signal),
  weatherImpact: (signal?: AbortSignal) => get<WeatherImpactResponse>('/weather-impact', undefined, signal),
  whatIf: async (body: WhatIfRequest, signal?: AbortSignal): Promise<WhatIfResponse> => {
    try {
      const r = await http.post<WhatIfResponse>('/whatif', body, { signal })
      return r.data
    } catch (err) {
      throw toApiError(err)
    }
  },
}
