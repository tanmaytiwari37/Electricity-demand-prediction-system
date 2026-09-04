/** Chart tokens. Series colours follow the entity, never the rank:
 *  forecast = blue, actual = aqua, scenario = orange, solar = violet,
 *  temperature = magenta. Validated against surface-1 (#111113). */
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
  good: '#3a9d5d',
  warning: '#d9a21b',
  serious: '#e0784a',
  critical: '#d64545',
}

export const tickStyle = { fill: C.tick, fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }
export const axisLine = { stroke: C.axis }
export const legendStyle = { fontSize: 11, color: C.ink2, paddingBottom: 6 }

/** Sequential blue ramp (light = low, dark = high) from the validated palette,
 *  reversed for the dark surface so higher magnitude reads brighter. */
export const BLUE_RAMP = ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef', '#9ec5f4', '#b7d3f6']

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
