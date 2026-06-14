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
};

/** Visual-only markers for the home map backdrop. Not wired to planning logic. */
const HOME_POI_MARKERS: HomePoiMarker[] = [
  { id: "restaurant", label: "餐厅", x: 22, y: 26, pin: "#FFC300", chip: "#FFF6D6" },
  { id: "cafe", label: "咖啡", x: 70, y: 20, pin: "#F59E0B", chip: "#FEF3C7" },
  { id: "park", label: "公园", x: 44, y: 38, pin: "#4ADE80", chip: "#DCFCE7" },
  { id: "activity", label: "活动", x: 82, y: 46, pin: "#A78BFA", chip: "#EDE9FE" },
  { id: "mall", label: "商场", x: 18, y: 54, pin: "#94A3B8", chip: "#F1F5F9" },
  { id: "family", label: "亲子", x: 58, y: 58, pin: "#FB7185", chip: "#FFE4E6" },
  { id: "errand", label: "办事点", x: 36, y: 72, pin: "#64748B", chip: "#E2E8F0" },
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
      className={`relative pointer-events-none select-none overflow-hidden bg-[#e7edf3] ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#eef2f6] via-[#f5f2e8] to-[#e3eaf2]" />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 390 520" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="home-map-grid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M 26 0 L 0 0 0 26" fill="none" stroke="rgba(15,23,42,0.035)" strokeWidth="1" />
          </pattern>
          <linearGradient id="home-river" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(125,211,252,0.18)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0.28)" />
          </linearGradient>
        </defs>

        <rect width="390" height="520" fill="url(#home-map-grid)" />

        <ellipse cx="118" cy="188" rx="72" ry="48" fill="rgba(134,239,172,0.16)" />
        <ellipse cx="286" cy="332" rx="58" ry="36" fill="rgba(134,239,172,0.12)" />

        <path
          d="M-30 96 C 70 72, 150 132, 228 104 S 372 72, 430 118"
          fill="none"
          stroke="rgba(255,255,255,0.96)"
          strokeWidth="20"
          strokeLinecap="round"
        />
        <path
          d="M-30 96 C 70 72, 150 132, 228 104 S 372 72, 430 118"
          fill="none"
          stroke="rgba(148,163,184,0.32)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        <path
          d="M-8 238 C 82 206, 156 268, 246 234 S 352 202, 418 246"
          fill="none"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M-8 238 C 82 206, 156 268, 246 234 S 352 202, 418 246"
          fill="none"
          stroke="rgba(148,163,184,0.28)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        <path
          d="M36 372 C 126 344, 188 392, 286 364 S 364 334, 408 378"
          fill="none"
          stroke="rgba(255,255,255,0.88)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        <path
          d="M168 28 L168 492"
          fill="none"
          stroke="rgba(255,255,255,0.78)"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M52 292 L338 292"
          fill="none"
          stroke="rgba(255,255,255,0.72)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        <path
          d="M300 40 C 332 120, 318 220, 350 300 S 372 420, 330 500"
          fill="url(#home-river)"
          opacity="0.55"
        />

        {HOME_POI_MARKERS.map((marker) => {
          const { cx, cy } = markerCoords(marker);
          const labelWidth = marker.label.length * 11 + 14;
          const labelX = cx - labelWidth / 2;
          const labelY = cy + 14;

          return (
            <g key={marker.id} data-testid={`home-map-marker-${marker.id}`}>
              <circle cx={cx} cy={cy} r="13" fill="rgba(255,255,255,0.72)" />
              <circle cx={cx} cy={cy} r="8.5" fill={marker.pin} stroke="rgba(255,255,255,0.95)" strokeWidth="2" />
              <circle cx={cx} cy={cy - 2} r="2.2" fill="rgba(255,255,255,0.85)" />
              <rect
                x={labelX}
                y={labelY}
                width={labelWidth}
                height="18"
                rx="9"
                fill={marker.chip}
                stroke="rgba(15,23,42,0.06)"
                strokeWidth="1"
              />
              <text
                x={cx}
                y={labelY + 12}
                textAnchor="middle"
                fill="rgba(15,23,42,0.62)"
                fontSize="10"
                fontWeight="700"
              >
                {marker.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 bg-gradient-to-b from-white/42 via-white/10 to-white/55" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/82 via-white/45 to-transparent" />
    </div>
  );
}
