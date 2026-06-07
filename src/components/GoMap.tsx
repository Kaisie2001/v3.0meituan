import type { ScoredPoi } from "@/lib/types";

const levelStyle = {
  green: "bg-emerald-500 border-emerald-700",
  yellow: "bg-amber-400 border-amber-600",
  red: "bg-rose-500 border-rose-700",
  gray: "bg-slate-400 border-slate-600",
};

type GoMapProps = {
  pois: ScoredPoi[];
  selectedPoiId?: string;
  onSelectPoi: (poi: ScoredPoi) => void;
};

export function GoMap({ pois, selectedPoiId, onSelectPoi }: GoMapProps) {
  return (
    <section className="min-h-[560px] rounded-lg border border-black/5 bg-white p-4 shadow-soft">
      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-bold">动态推荐地图</h2>
          <p className="text-sm text-black/58">颜色代表本次需求下的成行等级，不等同于商家评分。</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-black/66 sm:grid-cols-4">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />高度适配</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />可选有风险</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />不建议</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-slate-400" />不可用</span>
        </div>
      </div>

      <div className="map-grid relative h-[470px] overflow-hidden rounded-lg border border-black/10 bg-[#fbfcfd]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M50 50 C58 42, 62 31, 74 25" stroke="#FFD100" strokeWidth="1.2" fill="none" opacity="0.8" />
          <path d="M50 50 C47 60, 54 66, 67 63" stroke="#1F2329" strokeWidth="0.7" strokeDasharray="2 2" fill="none" opacity="0.25" />
          <path d="M35 80 L78 28" stroke="#2F80ED" strokeWidth="0.8" fill="none" opacity="0.18" />
          <path d="M18 45 L86 45" stroke="#2F80ED" strokeWidth="0.8" fill="none" opacity="0.14" />
        </svg>

        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-white bg-meituan-yellow text-xs font-black shadow-lg">我</div>
          <div className="mt-1 rounded-full bg-white px-2 py-0.5 text-center text-xs font-semibold shadow">当前位置</div>
        </div>

        {pois.map((poi) => {
          const size = 20 + Math.round(poi.goabilityScore / 7);
          const selected = poi.id === selectedPoiId;
          return (
            <button
              key={poi.id}
              type="button"
              className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${levelStyle[poi.level]} shadow-lg transition hover:scale-110 ${
                selected ? "ring-4 ring-black/20" : ""
              }`}
              style={{ left: `${poi.x}%`, top: `${poi.y}%`, width: size, height: size }}
              onClick={() => onSelectPoi(poi)}
              title={`${poi.name} ${poi.goabilityScore}分`}
            >
              <span className="sr-only">{poi.name}</span>
            </button>
          );
        })}

        {pois.map((poi) => (
          <span
            key={`${poi.id}-label`}
            className="pointer-events-none absolute z-10 max-w-[118px] -translate-x-1/2 rounded bg-white/90 px-2 py-1 text-center text-[11px] font-semibold text-black/75 shadow-sm"
            style={{ left: `${poi.x}%`, top: `calc(${poi.y}% + 18px)` }}
          >
            {poi.name}
          </span>
        ))}
      </div>
    </section>
  );
}
