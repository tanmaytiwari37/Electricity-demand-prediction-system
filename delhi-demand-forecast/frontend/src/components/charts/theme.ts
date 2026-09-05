import { createElement } from 'react'

/** Chart tokens. Series colours follow the entity, never the rank:
 *  forecast = blue, actual = aqua, scenario = orange, solar = violet,
 *  temperature = magenta. Validated against the #111113 black chart surface
 *  with the dataviz palette validator (lightness band, chroma, CVD
 *  separation, normal-vision floor and contrast all pass). */
export const C = {
  forecast: '#3987e5',
  actual: '#199e70',
  scenario: '#d95926',
  solar: '#9085e9',
  magenta: '#d55181',
  grid: '#1f1f23',
  axis: '#2f2f35',
  tick: '#6b6b74',
  ink: '#f4f4f5',
  ink2: '#a1a1aa',
  surface: '#111113',
  good: '#2fb36a',
  warning: '#e8a83a',
  serious: '#ec835a',
  critical: '#f05a5a',
}

export const tickStyle = { fill: C.tick, fontSize: 11, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }
export const axisLine = { stroke: C.axis }
export const legendStyle = { fontSize: 11, color: C.ink2, paddingBottom: 6 }
/** Recharts paints legend labels in the series colour by default; text wears ink. */
export const legendText = (value: string) => createElement('span', { style: { color: C.ink2 } }, value)

/** Sequential blue ramp (dark = low, bright = high). On the dark surface
 *  higher magnitude reads brighter; lightness rises monotonically. */
export const BLUE_RAMP = ['#1a2333', '#1c2f4d', '#1f3d6b', '#245086', '#2a63a2', '#2f76bd', '#3987e5', '#5a9cec', '#7eb3f2', '#a6cbf7']

export function rampColor(t: number): string {
  const i = Math.min(BLUE_RAMP.length - 1, Math.max(0, Math.floor(t * BLUE_RAMP.length)))
  return BLUE_RAMP[i]
}

export function niceDomain(min: number, max: number, include?: number): [number, number] {
  const hi = Math.max(max, include ?? -Infinity)
  const lo = Math.min(min, include ?? Infinity)
  const span = hi - lo || 1000
  return [Math.max(0, Math.floor((lo - span * 0.08) / 250) * 250), Math.ceil((hi + span * 0.06) / 250) * 250]
}
