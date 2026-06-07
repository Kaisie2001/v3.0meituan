import type { ParseResult } from "@/lib/types";

type IntentSummaryProps = {
  parseResult?: ParseResult;
};

export function IntentSummary({ parseResult }: IntentSummaryProps) {
  if (!parseResult) return null;
  const intent = parseResult.intent;
  const missing = parseResult.missingFields;
  const dims = intent.semantic?.dims;

  const profileText = dims
    ? [
        dims.quietPreference > 0.6 ? "偏安静" : "偏热闹",
        dims.indoorPreference > 0.6 ? "偏室内" : "偏户外",
        dims.queueTolerance < 0.4 ? "不爱排队" : dims.queueTolerance > 0.7 ? "可接受排队" : "排队可接受",
        dims.activityFirst > 0.55 ? "活动优先" : "吃饭优先",
        dims.budgetLevel < 0.45 ? "偏省钱" : dims.budgetLevel > 0.75 ? "偏享受" : "预算中等",
      ].join(" / ")
    : "";

  return (
    <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft">
      <h2 className="mb-3 text-base font-bold">需求理解</h2>
      <div className="grid gap-3 text-sm text-black/72 md:grid-cols-6">
        <div>
          <p className="font-semibold text-black">时间窗口</p>
          <p>
            {intent.timeWindow.start}-{intent.timeWindow.end}
            {intent.durationMinutes ? `（${intent.durationMinutes} 分钟）` : ""}
          </p>
        </div>
        <div>
          <p className="font-semibold text-black">人群与通勤</p>
          <p>
            {intent.partySize ? `${intent.partySize} 人` : "人数未知"}，{intent.maxCommuteMinutes ? `通勤 ≤${intent.maxCommuteMinutes} 分钟` : "通勤未知"}
          </p>
        </div>
        <div>
          <p className="font-semibold text-black">关键偏好</p>
          <p>{intent.needTags.length ? intent.needTags.slice(0, 5).join(" / ") : "未识别到明确偏好"}</p>
        </div>
        <div>
          <p className="font-semibold text-black">约束</p>
          <p>人均 {intent.budgetPerPerson} 内，{intent.preferMetro ? "优先地铁" : "无地铁偏好"}</p>
        </div>
        <div>
          <p className="font-semibold text-black">解析状态</p>
          <p>
            {parseResult.source}，置信度 {Math.round(parseResult.confidence * 100)}%
            {missing.length ? `（待补全：${missing.join(" / ")}）` : ""}
          </p>
        </div>
        <div className="md:col-span-2">
          <p className="font-semibold text-black">语义画像（推断）</p>
          <p>{profileText || "未生成画像"}</p>
        </div>
      </div>
    </section>
  );
}
