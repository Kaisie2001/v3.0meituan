type HomeMapPlaceholderProps = {
  className?: string;
};

const POI_MARKERS = [
  { x: 22, y: 28, tone: "yellow" },
  { x: 68, y: 22, tone: "orange" },
  { x: 48, y: 42, tone: "white" },
  { x: 78, y: 52, tone: "yellow" },
  { x: 30, y: 58, tone: "white" },
  { x: 58, y: 68, tone: "orange" },
] as const;

export function HomeMapPlaceholder({ className = "" }: HomeMapPlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      className={`relative pointer-events-none select-none overflow-hidden bg-gradient-to-br from-[#eef2f6] via-[#f6f3ea] to-[#e8edf2] ${className}`}
    >
      <svg className="h-full w-full" viewBox="0 0 390 520" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="home-map-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(15,23,42,0.04)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="390" height="520" fill="url(#home-map-grid)" />
        <path
          d="M-20 120 C 80 90, 140 150, 220 118 S 360 80, 420 130"
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d="M-20 120 C 80 90, 140 150, 220 118 S 360 80, 420 130"
          fill="none"
          stroke="rgba(148,163,184,0.35)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M-10 250 C 70 220, 150 280, 240 245 S 350 210, 410 255"
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M-10 250 C 70 220, 150 280, 240 245 S 350 210, 410 255"
          fill="none"
          stroke="rgba(148,163,184,0.3)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M30 380 C 120 350, 180 400, 280 370 S 360 340, 400 385"
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M30 380 C 120 350, 180 400, 280 370 S 360 340, 400 385"
          fill="none"
          stroke="rgba(148,163,184,0.28)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M180 40 L180 480"
          fill="none"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M60 300 L330 300"
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        {POI_MARKERS.map((marker) => {
          const fill =
            marker.tone === "yellow" ? "#FFC300" : marker.tone === "orange" ? "#FB923C" : "#FFFFFF";
          const stroke = marker.tone === "white" ? "rgba(148,163,184,0.45)" : "rgba(15,23,42,0.12)";
          const cx = (marker.x / 100) * 390;
          const cy = (marker.y / 100) * 520;
          return (
            <g key={`${marker.x}-${marker.y}`}>
              <circle cx={cx} cy={cy} r="11" fill="rgba(255,255,255,0.55)" />
              <circle cx={cx} cy={cy} r="7" fill={fill} stroke={stroke} strokeWidth="1.5" />
            </g>
          );
        })}
        <rect x="24" y="430" width="132" height="52" rx="12" fill="rgba(255,255,255,0.55)" />
        <rect x="28" y="438" width="72" height="8" rx="4" fill="rgba(15,23,42,0.08)" />
        <rect x="28" y="452" width="96" height="6" rx="3" fill="rgba(15,23,42,0.05)" />
        <rect x="28" y="464" width="56" height="6" rx="3" fill="rgba(15,23,42,0.04)" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/70 to-transparent" />
    </div>
  );
}
