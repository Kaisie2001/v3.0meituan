import { getPersonaConfig } from "@/lib/persona";
import type { ParseResult } from "@/lib/types";

type TripPersonaCardProps = {
  parseResult?: ParseResult;
  variant?: "full" | "compact";
};

export function TripPersonaCard({ parseResult, variant = "full" }: TripPersonaCardProps) {
  if (!parseResult) return null;

  const config = getPersonaConfig(parseResult);

  if (variant === "compact") {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-black/5 bg-white/90 px-3 py-2">
        <span className="text-[11px] font-bold text-black/45">出行画像</span>
        <span className="rounded-full bg-meituan-yellow px-2 py-0.5 text-[11px] font-extrabold text-meituan-ink">{config.label}</span>
        {config.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="rounded-full bg-meituan-gray px-2 py-0.5 text-[11px] font-bold text-black/55">
            {tag}
          </span>
        ))}
      </div>
    );
  }

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
