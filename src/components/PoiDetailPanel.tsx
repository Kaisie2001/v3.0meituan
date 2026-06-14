"use client";

import type { ScoredPoi } from "@/lib/types";

type PoiDetailPanelProps = {
  poi: ScoredPoi;
  onClose: () => void;
  onDislike: (poi: ScoredPoi) => void;
};

export function PoiDetailPanel({ poi, onClose, onDislike }: PoiDetailPanelProps) {
  return (
    <section data-testid="selected-poi-detail" className="rounded-lg border border-black/5 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">{poi.name}</h2>
          <p className="mt-1 text-sm text-black/60">
            {poi.category} · 评分 {poi.rating} · 人均 {poi.pricePerPerson} 元 · ETA {poi.routeEtaMinutes} 分钟 · 排队 {poi.queueMinutes} 分钟
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-bold text-black/65 hover:bg-black/5"
          >
            收起
          </button>
          <button
            type="button"
            onClick={() => onDislike(poi)}
            className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-bold text-white hover:brightness-95"
          >
            我不喜欢
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold text-black/75">推荐理由</p>
          <ul className="mt-2 space-y-1 text-sm text-black/68">
            {poi.reasons.map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold text-black/75">风险提示</p>
          <ul className="mt-2 space-y-1 text-sm text-black/68">
            {poi.risks.slice(0, 5).map((risk) => (
              <li key={risk}>- {risk}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

