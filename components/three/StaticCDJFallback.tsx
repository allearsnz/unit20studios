/**
 * Static SVG stand-in for the 3D CDJ scene.
 * Server-rendered, no JS. Shown to crawlers, no-JS users, reduced-motion
 * users, and any client without WebGL. Purely decorative.
 */
export function StaticCDJFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center" aria-hidden>
      <svg
        viewBox="0 0 400 400"
        className="h-full max-h-[560px] w-full max-w-[560px]"
        role="presentation"
      >
        <defs>
          <radialGradient id="u20-platter" cx="50%" cy="44%" r="62%">
            <stop offset="0%" stopColor="#323232" />
            <stop offset="68%" stopColor="#1a1a1a" />
            <stop offset="100%" stopColor="#0e0e0e" />
          </radialGradient>
          <filter id="u20-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* deck body */}
        <rect
          x="38"
          y="38"
          width="324"
          height="324"
          rx="20"
          fill="#141414"
          stroke="rgba(245,241,234,0.10)"
        />
        {/* platter */}
        <circle
          cx="200"
          cy="188"
          r="122"
          fill="url(#u20-platter)"
          stroke="rgba(245,241,234,0.12)"
        />
        {/* grooves */}
        {[106, 90, 74, 58].map((r) => (
          <circle
            key={r}
            cx="200"
            cy="188"
            r={r}
            fill="none"
            stroke="rgba(245,241,234,0.06)"
          />
        ))}
        {/* record label */}
        <circle
          cx="200"
          cy="188"
          r="34"
          fill="#06281d"
          stroke="#3ddc97"
          strokeOpacity="0.4"
        />
        {/* spindle */}
        <circle cx="200" cy="188" r="6" fill="#3ddc97" filter="url(#u20-glow)" />
        {/* screen */}
        <rect
          x="150"
          y="322"
          width="100"
          height="26"
          rx="3"
          fill="#06281d"
          stroke="#3ddc97"
          strokeOpacity="0.5"
        />
        <rect x="156" y="332" width="58" height="3" fill="#3ddc97" opacity="0.7" />
        {/* knobs */}
        {[
          [72, 330],
          [102, 330],
          [330, 78],
          [330, 108],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="8"
            fill="#1a1a1a"
            stroke="rgba(245,241,234,0.12)"
          />
        ))}
      </svg>
    </div>
  );
}
