import type { FeederStatus, RiskLevel } from '../types/api.ts'

const IST = 'Asia/Kolkata'

export const fmtInt = (n: number | null | undefined): string =>
  n == null || Number.isNaN(n) ? '–' : Math.round(n).toLocaleString('en-IN')

export const fmtMW = (n: number | null | undefined): string => (n == null ? '–' : `${fmtInt(n)} MW`)

export const fmtSigned = (n: number | null | undefined, unit = 'MW'): string => {
  if (n == null) return '–'
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${fmtInt(Math.abs(n))} ${unit}`
}

export const fmtPct = (n: number | null | undefined, digits = 1): string =>
  n == null ? '–' : `${n.toFixed(digits)}%`

export const fmtTemp = (n: number | null | undefined): string => (n == null ? '–' : `${n.toFixed(1)} °C`)

const hourFmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: IST })
const dayHourFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: IST })
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', timeZone: IST })
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: IST,
})

export const fmtHour = (ts: string): string => hourFmt.format(new Date(ts))
export const fmtDayHour = (ts: string): string => dayHourFmt.format(new Date(ts))
export const fmtDate = (ts: string): string => dateFmt.format(new Date(ts))
export const fmtDateTime = (ts: string): string => `${dateTimeFmt.format(new Date(ts))} IST`

/** Axis tick: show the hour, and the date on midnight ticks. */
export const fmtTick = (ts: string): string => {
  const d = new Date(ts)
  const h = hourFmt.format(d)
  return h === '00:00' ? dateFmt.format(d) : h
}

export const hoursLabel = (h: number): string => (h % 24 === 0 && h >= 48 ? `${h / 24} days` : `${h} h`)

export interface ToneMeta {
  label: string
  text: string
  bg: string
  border: string
  dot: string
  icon: string
}

export const riskMeta: Record<RiskLevel, ToneMeta> = {
  low: { label: 'LOW', text: 'text-good', bg: 'bg-good/10', border: 'border-good/40', dot: 'bg-good', icon: '●' },
  medium: { label: 'MEDIUM', text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/40', dot: 'bg-warning', icon: '▲' },
  high: { label: 'HIGH', text: 'text-serious', bg: 'bg-serious/10', border: 'border-serious/40', dot: 'bg-serious', icon: '▲' },
  critical: { label: 'CRITICAL', text: 'text-critical', bg: 'bg-critical/10', border: 'border-critical/40', dot: 'bg-critical', icon: '■' },
}

export const feederMeta: Record<FeederStatus, ToneMeta> = {
  ok: { ...riskMeta.low, label: 'OK' },
  warning: { ...riskMeta.medium, label: 'WARNING' },
  critical: { ...riskMeta.critical, label: 'CRITICAL' },
}

export const riskFromUtil = (utilPct: number, t = { medium: 85, high: 92, critical: 97 }): RiskLevel =>
  utilPct >= t.critical ? 'critical' : utilPct >= t.high ? 'high' : utilPct >= t.medium ? 'medium' : 'low'
