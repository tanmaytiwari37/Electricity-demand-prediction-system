/** Landing-page emblem: a glowing disc holding sun, storm cloud, lightning,
 *  rain and a thermometer, ringed by slowly rotating orbits. Motion lives in
 *  CSS classes (index.css, `lp-*`) so it stays cheap and respects
 *  prefers-reduced-motion. The thermometer reads the live temperature. */
export default function WeatherEmblem({ tempC, size = 420, onClick }: { tempC: number | null; size?: number; onClick?: () => void }) {
  const heat = tempC == null ? 0.55 : Math.max(0, Math.min(1, (tempC - 5) / 40))
  const tubeTop = 92, tubeBottom = 168
  const fillY = tubeBottom - (tubeBottom - tubeTop) * heat
  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      className="lp-emblem max-w-full"
      role={onClick ? 'button' : 'img'}
      aria-label={onClick ? 'Enter the dashboard' : 'Weather and demand emblem'}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick() } }}
    >
      <defs>
        <radialGradient id="lp-disc" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#0f1b2d" />
          <stop offset="70%" stopColor="#070a12" />
          <stop offset="100%" stopColor="#05060a" />
        </radialGradient>
        <radialGradient id="lp-halo" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#3987e5" stopOpacity="0" />
          <stop offset="85%" stopColor="#3987e5" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3987e5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lp-sun" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="55%" stopColor="#f5a623" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
        <radialGradient id="lp-sunglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f5a623" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#f5a623" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lp-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#b9c4d6" />
        </linearGradient>
        <linearGradient id="lp-cloud-shadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a97ad" />
          <stop offset="100%" stopColor="#5b6780" />
        </linearGradient>
        <linearGradient id="lp-bolt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe6ff" />
          <stop offset="100%" stopColor="#3987e5" />
        </linearGradient>
        <filter id="lp-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="lp-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <clipPath id="lp-tube"><rect x="296" y="88" width="14" height="84" rx="7" /></clipPath>
      </defs>

      {/* halo and orbit rings */}
      <circle className="lp-halo" cx="200" cy="200" r="196" fill="url(#lp-halo)" />
      <g className="lp-orbit">
        <circle cx="200" cy="200" r="182" fill="none" stroke="#2a4a74" strokeWidth="0.8" strokeDasharray="3 9" />
        <circle cx="200" cy="18" r="2.6" fill="#7cc4ff" filter="url(#lp-glow)" />
        <circle cx="382" cy="200" r="1.8" fill="#9085e9" />
      </g>
      <g className="lp-orbit-rev">
        <circle cx="200" cy="200" r="168" fill="none" stroke="#1e3554" strokeWidth="0.8" />
        <circle cx="32" cy="200" r="2.2" fill="#f5a623" filter="url(#lp-glow)" />
      </g>
      <path d="M40 120 L120 118" stroke="#2a4a74" strokeWidth="1" strokeLinecap="round" />
      <path d="M300 250 L360 262" stroke="#2a4a74" strokeWidth="1" strokeLinecap="round" />

      {/* disc */}
      <circle cx="200" cy="200" r="150" fill="url(#lp-disc)" stroke="#2c4f7d" strokeWidth="1.5" />
      <circle cx="200" cy="200" r="150" fill="none" stroke="#7cc4ff" strokeOpacity="0.25" strokeWidth="6" filter="url(#lp-soft)" />

      {/* sun */}
      <circle className="lp-sun-glow" cx="262" cy="108" r="58" fill="url(#lp-sunglow)" />
      <circle cx="262" cy="108" r="30" fill="url(#lp-sun)" filter="url(#lp-glow)" />
      <circle cx="262" cy="108" r="30" fill="none" stroke="#ffe08a" strokeOpacity="0.5" strokeWidth="1" />

      {/* thermometer */}
      <text x="322" y="98" fill="#7cc4ff" fontSize="12" fontFamily="JetBrains Mono, ui-monospace, monospace">{tempC != null ? `${Math.round(tempC)}°` : '–'}</text>
      <rect x="296" y="88" width="14" height="84" rx="7" fill="#10141c" stroke="#3b5f8f" strokeWidth="1" />
      <rect x="296" y={fillY} width="14" height={tubeBottom - fillY + 10} fill="#3987e5" clipPath="url(#lp-tube)" />
      <circle cx="303" cy="178" r="11" fill="#3987e5" stroke="#3b5f8f" strokeWidth="1" filter="url(#lp-glow)" />
      {[104, 122, 140, 158].map((y) => <line key={y} x1="311" y1={y} x2="317" y2={y} stroke="#3b5f8f" strokeWidth="1" />)}

      {/* cloud */}
      <g className="lp-cloud">
        <g opacity="0.55" filter="url(#lp-soft)"><ellipse cx="190" cy="205" rx="78" ry="22" fill="#000" /></g>
        <g fill="url(#lp-cloud-shadow)">
          <circle cx="150" cy="186" r="26" /><circle cx="186" cy="170" r="36" /><circle cx="226" cy="184" r="28" /><rect x="150" y="184" width="104" height="26" rx="13" />
        </g>
        <g fill="url(#lp-cloud)">
          <circle cx="150" cy="180" r="26" /><circle cx="186" cy="164" r="36" /><circle cx="226" cy="178" r="28" /><rect x="150" y="178" width="104" height="26" rx="13" />
        </g>
      </g>

      {/* rain */}
      <g className="lp-rain" stroke="#7cc4ff" strokeWidth="2" strokeLinecap="round" strokeDasharray="8 16" opacity="0.8">
        <line x1="146" y1="212" x2="138" y2="252" /><line x1="240" y1="214" x2="232" y2="254" /><line x1="166" y1="222" x2="160" y2="250" />
      </g>

      {/* lightning */}
      <g filter="url(#lp-glow)">
        <polygon className="lp-bolt" points="200,206 184,242 197,242 188,276 214,232 200,232 210,206" fill="url(#lp-bolt)" />
        <polygon className="lp-bolt lp-bolt-2" points="228,212 218,238 227,238 221,262 240,232 230,232 236,212" fill="url(#lp-bolt)" opacity="0.8" />
      </g>

      {/* small satellites */}
      <circle cx="110" cy="248" r="5" fill="#3987e5" opacity="0.8" />
      <circle cx="290" cy="248" r="3" fill="#7cc4ff" />
    </svg>
  )
}
