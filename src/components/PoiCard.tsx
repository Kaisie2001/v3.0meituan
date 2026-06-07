import type { ScoredPoi } from "@/lib/types";

const levelLabel = {
  green: "高度推荐",
  yellow: "可选",
  red: "不建议",
  gray: "不可用",
};

const levelClass = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  gray: "bg-slate-100 text-slate-600 border-slate-200",
};

type PoiCardProps = {
  poi: ScoredPoi;
  selected?: boolean;
  onSelect: (poi: ScoredPoi) => void;
};

export function PoiCard({ poi, selected, onSelect }: PoiCardProps) {
  return (
    <article className={`rounded-lg border bg-white p-4 shadow-sm transition ${selected ? "border-meituan-yellow ring-2 ring-meituan-yellow/40" : "border-black/8"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{poi.name}</h3>
          <p className="text-sm text-black/55">{poi.category} · 评分 {poi.rating}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${levelClass[poi.level]}`}>
          {levelLabel[poi.level]}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded bg-meituan-gray p-2"><b className="block text-base">{poi.goabilityScore}</b>成行分</div>
        <div className="rounded bg-meituan-gray p-2"><b className="block text-base">{poi.distanceMeters}m</b>距离</div>
        <div className="rounded bg-meituan-gray p-2"><b className="block text-base">{poi.routeEtaMinutes}m</b>ETA</div>
        <div className="rounded bg-meituan-gray p-2"><b className="block text-base">{poi.queueMinutes}m</b>排队</div>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <p className="font-bold">适合原因</p>
          <ul className="mt-1 space-y-1 text-black/68">
            {poi.reasons.map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-bold">风险</p>
          <ul className="mt-1 space-y-1 text-black/68">
            {poi.risks.slice(0, 3).map((risk) => (
              <li key={risk}>- {risk}</li>
            ))}
          </ul>
        </div>
      </div>

      <button
        className="mt-4 w-full rounded-lg border border-black/10 bg-meituan-yellow px-3 py-2 text-sm font-bold transition hover:brightness-95"
        type="button"
        onClick={() => onSelect(poi)}
      >
        查看并纳入方案
      </button>
    </article>
  );
}
