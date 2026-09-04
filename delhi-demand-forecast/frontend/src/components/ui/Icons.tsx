import type { SVGProps } from 'react'

/** Minimal 1.5px line icons. One component per glyph, all sharing the same
 *  frame so they align in navigation and module headers. */
type P = SVGProps<SVGSVGElement> & { size?: number }

function Frame({ size = 16, children, ...rest }: P) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  )
}

export const IconOverview = (p: P) => (
  <Frame {...p}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Frame>
)
export const IconForecast = (p: P) => (
  <Frame {...p}><path d="M3 17l5-6 4 3 5-8 4 5" /><path d="M3 21h18" /></Frame>
)
export const IconAlerts = (p: P) => (
  <Frame {...p}><path d="M12 3l9.5 16.5H2.5L12 3z" /><path d="M12 10v4" /><path d="M12 17.5h.01" /></Frame>
)
export const IconAreas = (p: P) => (
  <Frame {...p}><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z" /><path d="M9 4v13" /><path d="M15 7v13" /></Frame>
)
export const IconWeather = (p: P) => (
  <Frame {...p}><circle cx="12" cy="12" r="3.5" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></Frame>
)
export const IconScenario = (p: P) => (
  <Frame {...p}><path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" /><path d="M4 17h4" /><path d="M12 17h8" /><circle cx="10" cy="17" r="2" /></Frame>
)
export const IconModel = (p: P) => (
  <Frame {...p}><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7.5 7.5L11 16M16.5 7.5L13 16M8 6h8" /></Frame>
)
export const IconHome = (p: P) => (
  <Frame {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h5v-6h4v6h5V10" /></Frame>
)
export const IconArrow = (p: P) => (
  <Frame {...p}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></Frame>
)
export const IconChevron = (p: P) => (
  <Frame {...p}><path d="M6 9l6 6 6-6" /></Frame>
)
export const IconMenu = (p: P) => (
  <Frame {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Frame>
)
export const IconClose = (p: P) => (
  <Frame {...p}><path d="M6 6l12 12M18 6L6 18" /></Frame>
)
export const IconBolt = (p: P) => (
  <Frame {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></Frame>
)
export const IconThermo = (p: P) => (
  <Frame {...p}><path d="M10 4a2 2 0 014 0v9.3a4 4 0 11-4 0V4z" /><path d="M12 9v6" /></Frame>
)
export const IconDroplet = (p: P) => (
  <Frame {...p}><path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z" /></Frame>
)

/** PEAKWATCH mark: a demand curve crossing a capacity line. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect x="0.5" y="0.5" width="31" height="31" rx="6" fill="#111113" stroke="#2f2f35" />
      <path d="M6 21 L11 13 L15 17 L20 8 L26 15" fill="none" stroke="#f4f4f5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 25 H26" stroke="#3987e5" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="20" cy="8" r="2.4" fill="#d64545" />
    </svg>
  )
}
