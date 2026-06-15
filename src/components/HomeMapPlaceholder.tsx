type HomeMapPlaceholderProps = {
  className?: string;
};

type HomePoiMarker = {
  id: string;
  label: string;
  x: number;
  y: number;
  pin: string;
  chip: string;
  primary?: boolean;
};

/** Visual-only markers for the home map backdrop. Not wired to planning logic. */
const HOME_POI_MARKERS: HomePoiMarker[] = [
  { id: "restaurant", label: "餐厅", x: 22, y: 26, pin: "#E2B84A", chip: "rgba(255,252,244,0.82)", primary: true },
  { id: "cafe", label: "咖啡", x: 70, y: 20, pin: "#D1D5DB", chip: "rgba(255,255,255,0.72)" },
  { id: "park", label: "公园", x: 44, y: 38, pin: "#D1D5DB", chip: "rgba(255,255,255,0.72)" },
  { id: "activity", label: "活动", x: 82, y: 46, pin: "#E5E7EB", chip: "rgba(255,255,255,0.72)" },
  { id: "mall", label: "商场", x: 18, y: 54, pin: "#E5E7EB", chip: "rgba(255,255,255,0.72)" },
  { id: "family", label: "亲子", x: 58, y: 58, pin: "#E5E7EB", chip: "rgba(255,255,255,0.72)" },
  { id: "errand", label: "办事点", x: 36, y: 72, pin: "#E2E8F0", chip: "rgba(255,255,255,0.72)" },
];

function markerCoords(marker: HomePoiMarker) {
  return {
    cx: (marker.x / 100) * 390,
    cy: (marker.y / 100) * 520,
  };
}

export function HomeMapPlaceholder({ className = "" }: HomeMapPlaceholderProps) {
  return (
    <div
      data-testid="home-map-background"
      aria-hidden="true"
      className={`home-map-soft-theme relative pointer-events-none select-none overflow-hidden bg-[#f3f4f0] ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#f4f5f2] via-[#f7f6f2] to-[#eef1f0]" />

      <svg
        className="absolute inset-0 h-full w-full opacity-90"
        style={{ filter: "grayscale(0.2) saturate(0.58) brightness(1.06) contrast(0.92)" }}
        viewBox="0 0 390 520"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="home-map-grid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M 26 0 L 0 0 0 26" fill="none" stroke="rgba(15,23,42,0.028)" strokeWidth="1" />
          </pattern>
          <linearGradient id="home-river" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(186,230,253,0.12)" />
            <stop offset="100%" stopColor="rgba(148,163,184,0.16)" />
          </linearGradient>
        </defs>

        <rect width="390" height="520" fill="url(#home-map-grid)" />

        <ellipse cx="118" cy="188" rx="72" ry="48" fill="rgba(187,247,208,0.1)" />
        <ellipse cx="286" cy="332" rx="58" ry="36" fill="rgba(187,247,208,0.08)" />

        <path
          d="M-30 96 C 70 72, 150 132, 228 104 S 372 72, 430 118"
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d="M-30 96 C 70 72, 150 132, 228 104 S 372 72, 430 118"
          fill="none"
          stroke="rgba(148,163,184,0.22)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        <path
          d="M-8 238 C 82 206, 156 268, 246 234 S 352 202, 418 246"
          fill="none"
          stroke="rgba(255,255,255,0.86)"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path
          d="M-8 238 C 82 206, 156 268, 246 234 S 352 202, 418 246"
          fill="none"
          stroke="rgba(148,163,184,0.2)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        <path
          d="M36 372 C 126 344, 188 392, 286 364 S 364 334, 408 378"
          fill="none"
          stroke="rgba(255,255,255,0.82)"
          strokeWidth="11"
          strokeLinecap="round"
        />

        <path
          d="M168 28 L168 492"
          fill="none"
          stroke="rgba(255,255,255,0.72)"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M52 292 L338 292"
          fill="none"
          stroke="rgba(255,255,255,0.68)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        <path
          d="M300 40 C 332 120, 318 220, 350 300 S 372 420, 330 500"
          fill="url(#home-river)"
          opacity="0.42"
        />

        {HOME_POI_MARKERS.map((marker) => {
          const { cx, cy } = markerCoords(marker);
          const labelWidth = marker.label.length * 10 + 12;
          const labelX = cx - labelWidth / 2;
          const labelY = cy + 12;
          const pinRadius = marker.primary ? 7 : 6;

          return (
            <g key={marker.id} data-testid={`home-map-marker-${marker.id}`}>
              <circle cx={cx} cy={cy} r="11" fill="rgba(255,255,255,0.62)" />
              <circle
                cx={cx}
                cy={cy}
                r={pinRadius}
                fill={marker.pin}
                stroke="rgba(255,255,255,0.92)"
                strokeWidth="1.5"
                opacity={marker.primary ? 0.9 : 0.72}
              />
              <rect
                x={labelX}
                y={labelY}
                width={labelWidth}
                height="16"
                rx="8"
                fill={marker.chip}
                stroke="rgba(15,23,42,0.04)"
                strokeWidth="1"
              />
              <text
                x={cx}
                y={labelY + 11}
                textAnchor="middle"
                fill="rgba(15,23,42,0.44)"
                fontSize="9"
                fontWeight="600"
              >
                {marker.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 bg-gradient-to-b from-white/38 via-white/12 to-white/48" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/48 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/78 via-white/38 to-transparent" />
    </div>
  );
}
