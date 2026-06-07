import type { ScoredPoi } from "@/lib/types";
import { PoiCard } from "./PoiCard";

type RecommendationPanelProps = {
  pois: ScoredPoi[];
  selectedPoiId?: string;
  onSelectPoi: (poi: ScoredPoi) => void;
};

export function RecommendationPanel({ pois, selectedPoiId, onSelectPoi }: RecommendationPanelProps) {
  const topPois = pois.slice(0, 3);

  return (
    <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Top 3 推荐</h2>
          <p className="text-sm text-black/58">按本次需求成行分排序</p>
        </div>
      </div>
      <div className="space-y-3">
        {topPois.map((poi) => (
          <PoiCard key={poi.id} poi={poi} selected={poi.id === selectedPoiId} onSelect={onSelectPoi} />
        ))}
      </div>
    </section>
  );
}
