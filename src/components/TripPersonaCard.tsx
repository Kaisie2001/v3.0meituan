import { getPersonaConfig } from "@/lib/persona";
import type { ParseResult } from "@/lib/types";

type TripPersonaCardProps = {
  parseResult?: ParseResult;
};

export function TripPersonaCard({ parseResult }: TripPersonaCardProps) {
  if (!parseResult) return null;

  const config = getPersonaConfig(parseResult);

  return (
    <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-black/45">本次出行画像</p>
          <p className="mt-1 text-base font-extrabold text-meituan-ink">{config.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-meituan-yellow px-3 py-1.5 text-xs font-extrabold text-meituan-ink">{config.label}</span>
          {config.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-meituan-gray px-3 py-1.5 text-xs font-bold text-black/60">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
