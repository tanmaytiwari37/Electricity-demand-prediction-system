/** Chart tokens. Series colours follow the entity, never the rank:
 *  forecast = blue, actual = aqua, scenario = orange, solar = violet. */
export const C = {
  forecast: '#3987e5',
  actual: '#199e70',
  scenario: '#d95926',
  solar: '#9085e9',
  magenta: '#d55181',
  grid: '#22304a',
  axis: '#33436a',
  tick: '#6b7a93',
  ink: '#e6edf7',
  ink2: '#a3b1c6',
  surface: '#0f172a',
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
}

export const tickStyle = { fill: C.tick, fontSize: 11 }
export const axisLine = { stroke: C.axis }

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
