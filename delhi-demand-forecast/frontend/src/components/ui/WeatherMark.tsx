/** Large weather-and-demand emblem for the Overview. A sun disc with a
 *  thermometer gauge and a demand curve that rises with heat, drawn as
 *  line work in the interface greys with a single warm accent. Static by
 *  design: no animation. The `heat` argument (0-1) fills the thermometer
 *  from the live temperature so the mark reflects real conditions. */
export default function WeatherMark({ heat = 0.5, size = 220 }: { heat?: number; size?: number }) {
  const h = Math.max(0, Math.min(1, heat))
  const tubeTop = 62, tubeBottom = 150
  const fillY = tubeBottom - (tubeBottom - tubeTop) * h
  return (
    <svg viewBox="0 0 240 200" width={size} height={(size * 200) / 240} role="img" aria-label="Weather and demand emblem" className="max-w-full">
      <defs>
        <clipPath id="wm-tube"><rect x="182" y="60" width="16" height="92" rx="8" /></clipPath>
      </defs>

      {/* concentric sun */}
      <circle cx="96" cy="86" r="58" fill="none" stroke="#222226" strokeWidth="1" />
      <circle cx="96" cy="86" r="44" fill="none" stroke="#2f2f35" strokeWidth="1" strokeDasharray="2 5" />
      <circle cx="96" cy="86" r="30" fill="#d9a21b" fillOpacity="0.08" stroke="#d9a21b" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx="96" cy="86" r="30" fill="none" stroke="#f4f4f5" strokeOpacity="0.12" strokeWidth="6" />
      {/* rays, only the upper arc so the curve can pass beneath */}
      {[-150, -120, -90, -60, -30].map((deg) => {
        const r1 = 38, r2 = 50
        const a = (deg * Math.PI) / 180
        return <line key={deg} x1={96 + r1 * Math.cos(a)} y1={86 + r1 * Math.sin(a)} x2={96 + r2 * Math.cos(a)} y2={86 + r2 * Math.sin(a)} stroke="#a1a1aa" strokeWidth="1.6" strokeLinecap="round" />
      })}

      {/* demand curve: night trough, afternoon peak, evening peak */}
      <path d="M12 168 C 40 168, 52 150, 70 132 S 104 96, 122 100 S 150 130, 160 122 S 178 92, 200 94" fill="none" stroke="#3987e5" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 168 C 40 168, 52 150, 70 132 S 104 96, 122 100 S 150 130, 160 122 S 178 92, 200 94 L 200 184 L 12 184 Z" fill="#3987e5" fillOpacity="0.06" />
      <line x1="12" y1="184" x2="228" y2="184" stroke="#2f2f35" strokeWidth="1" />
      <line x1="12" y1="112" x2="228" y2="112" stroke="#d64545" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="5 4" />
      <circle cx="200" cy="94" r="4" fill="#3987e5" stroke="#111113" strokeWidth="2" />

      {/* thermometer */}
      <rect x="182" y="60" width="16" height="92" rx="8" fill="#18181b" stroke="#2f2f35" strokeWidth="1" />
      <rect x="182" y={fillY} width="16" height={tubeBottom - fillY + 10} fill="#d64545" fillOpacity="0.85" clipPath="url(#wm-tube)" />
      <circle cx="190" cy="158" r="11" fill="#d64545" fillOpacity="0.85" stroke="#2f2f35" strokeWidth="1" />
      {[70, 90, 110, 130].map((y) => <line key={y} x1="200" y1={y} x2="206" y2={y} stroke="#6b6b74" strokeWidth="1" />)}
      <text x="212" y="66" fill="#6b6b74" fontSize="8" fontFamily="Inter, system-ui, sans-serif">°C</text>
      <text x="18" y="108" fill="#6b6b74" fontSize="8" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.06em">CAPACITY</text>
      <text x="18" y="196" fill="#6b6b74" fontSize="8" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.06em">00:00</text>
      <text x="192" y="196" fill="#6b6b74" fontSize="8" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.06em" textAnchor="end">23:00</text>
    </svg>
  )
}
