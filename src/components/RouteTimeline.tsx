import { inferPersona } from "@/lib/persona";
import { buildRouteGuidance } from "@/lib/routeGuidance";
import type { ParseResult, RoutePlan } from "@/lib/types";

type RouteTimelineProps = {
  routePlan?: RoutePlan;
  parseResult?: ParseResult;
  selectedPlanType?: "main" | "fallback";
  selectedFallbackIndex?: number | null;
};

const fallbackCopy = {
  friends: "这个替代方案离集合点更近，减少等人和临时改约成本。",
  family: "这个替代方案转场更少，更适合带孩子时快速切换。",
  date: "这个替代方案节奏更松，适合保留聊天和散步时间。",
  work: "这个替代方案等待更短，不压缩学习/办公/准备时间。",
  errand: "这个替代方案更顺路，方便先办事再停留或用餐。",
  casual: "这个替代方案更灵活，适合按排队、天气或心情随时替换。",
};

export function RouteTimeline({
  routePlan,
  parseResult,
  selectedPlanType = "main",
  selectedFallbackIndex = null,
}: RouteTimelineProps) {
  if (!routePlan) {
    return (
      <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft">
        <h2 className="text-lg font-bold">路线计划</h2>
        <p className="mt-2 text-sm text-black/58">点击生成后，将展示可执行路线。</p>
      </section>
    );
  }

  const fallbackPlans = routePlan.fallbackPlans ?? [];
  const primaryFallback = fallbackPlans[0];
  const hiddenFallbackCount = Math.max(0, fallbackPlans.length - 1);
  const mainSlots = routePlan.mainPlan?.slots ?? [];
  const fallbackPersonaCopy = parseResult ? fallbackCopy[inferPersona(parseResult)] : "";
  const routeGuidance =
    parseResult && routePlan
      ? buildRouteGuidance({
          routePlan,
          intent: parseResult.intent,
          selectedPlanType,
          selectedFallbackIndex,
        })
      : null;

  return (
    <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">路线计划</h2>
          <p className="text-sm text-black/58">按“通勤分钟 + 排队风险 + 可订状态”拼装的可执行方案</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${routePlan.fitsTimeWindow ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {routePlan.fitsTimeWindow ? "满足时间窗口" : "时间存在风险"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-meituan-gray p-3"><p className="text-xs text-black/55">总耗时</p><b>{routePlan.totalMinutes} 分钟</b></div>
        <div className="rounded-lg bg-meituan-gray p-3"><p className="text-xs text-black/55">总预算</p><b>{routePlan.totalBudget} 元</b></div>
        <div className="rounded-lg bg-meituan-gray p-3"><p className="text-xs text-black/55">预计等待</p><b>{routePlan.totalWaitMinutes} 分钟</b></div>
        <div className="rounded-lg bg-meituan-gray p-3"><p className="text-xs text-black/55">履约检查</p><b>{routePlan.fitsTimeWindow ? "可执行" : "需备选"}</b></div>
      </div>

      <div className="mt-4 space-y-0">
        {routePlan.steps.map((step, index) => (
          <div className="grid grid-cols-[84px_22px_1fr] gap-3" key={`${step.time}-${step.title}`}>
            <div className="pt-1 text-sm font-bold text-black/70">{step.time}</div>
            <div className="relative flex justify-center">
              <span className="mt-1 h-4 w-4 rounded-full border-2 border-white bg-meituan-yellow shadow" />
              {index < routePlan.steps.length - 1 ? <span className="absolute top-5 h-full w-px bg-black/12" /> : null}
            </div>
            <div className="pb-4">
              <p className="font-bold">{step.title}</p>
              <p className="text-sm text-black/62">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {routeGuidance ? (
        <div className="mt-4 rounded-lg border border-black/10 bg-meituan-gray/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-black/80">{routeGuidance.title}</h3>
            <span className="shrink-0 rounded-full bg-meituan-yellow/30 px-2 py-0.5 text-[10px] font-bold text-meituan-ink">
              {routeGuidance.transportLabel}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {routeGuidance.steps.map((step) => (
              <li key={step} className="text-xs leading-5 text-black/65">
                · {step}
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-black/8 pt-2 text-[11px] leading-4 text-black/45">{routeGuidance.mapDemoNote}</p>
        </div>
      ) : null}

      {mainSlots.length ? (
        <div className="mt-5 rounded-lg border border-black/10 bg-meituan-gray p-4">
          <h3 className="mb-3 text-sm font-extrabold text-black/80">主方案拆解</h3>
          <div className="space-y-3">
            {mainSlots.map((slot) => (
              <div key={`${slot.slotType}-${slot.startTime}`} className="rounded-lg bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-black/80">
                      {slot.slotType === "activity" ? "活动" : slot.slotType === "food" ? "用餐" : "加餐/散步"}：{slot.poi?.name ?? "待定"}
                    </p>
                    <p className="mt-1 text-xs text-black/55">
                      {slot.startTime}-{slot.endTime}（通勤 {slot.etaMinutes}m / 等待 {slot.waitMinutes}m）
                    </p>
                  </div>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold text-black/60">
                    人均 {slot.poi?.pricePerPerson ?? 0} 元
                  </span>
                </div>
                {slot.rationaleNotes.length ? (
                  <div className="mt-3 rounded-md bg-meituan-gray px-3 py-2 text-xs text-black/70">
                    <span className="font-bold text-black/75">为什么选它：</span>
                    <span className="ml-1">{slot.rationaleNotes.join(" / ")}</span>
                  </div>
                ) : null}
                {slot.riskNotes.length ? (
                  <div className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    <span className="font-bold">风险：</span>
                    <span className="ml-1">{slot.riskNotes.join(" / ")}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {fallbackPlans.length ? (
        <div className="mt-5 rounded-lg border border-black/10 bg-meituan-gray p-4">
          <h3 className="mb-3 text-sm font-extrabold text-black/80">备选方案</h3>
          <div className="space-y-3">
            {primaryFallback ? (
              <div key={primaryFallback.id} className="rounded-lg bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-black/80">{primaryFallback.title}</p>
                    {primaryFallback.trigger ? <p className="mt-1 text-xs text-black/55">触发：{primaryFallback.trigger}</p> : null}
                  </div>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold text-black/60">
                    等待 {primaryFallback.totalWaitMinutes}m / 预算 {primaryFallback.totalBudget} 元
                  </span>
                </div>
                {primaryFallback.diffFromMain ? (
                  <div className="mt-2 text-xs text-black/55">
                    如果主方案满座或排队过长，替换为 {primaryFallback.slots.find((slot) => slot.slotType === "food")?.poi?.name ?? primaryFallback.title}，预算{" "}
                    {primaryFallback.diffFromMain.deltaBudget >= 0 ? "+" : ""}{primaryFallback.diffFromMain.deltaBudget} 元 / 等待{" "}
                    {primaryFallback.diffFromMain.deltaWaitMinutes >= 0 ? "+" : ""}{primaryFallback.diffFromMain.deltaWaitMinutes}m / 通勤{" "}
                    {primaryFallback.diffFromMain.deltaCommuteMinutes >= 0 ? "+" : ""}{primaryFallback.diffFromMain.deltaCommuteMinutes}m
                  </div>
                ) : null}
                {fallbackPersonaCopy ? <div className="mt-2 rounded-md bg-yellow-50 px-3 py-2 text-xs font-semibold text-black/68">{fallbackPersonaCopy}</div> : null}
                <div className="mt-3 space-y-2">
                  {primaryFallback.steps.slice(1, 3).map((step) => (
                    <div key={`${primaryFallback.id}-${step.time}-${step.title}`} className="rounded-md bg-meituan-gray px-3 py-2 text-xs text-black/70">
                      <span className="font-bold text-black/75">{step.title}</span>
                      <span className="ml-2">{step.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {hiddenFallbackCount ? (
              <details className="rounded-lg bg-white px-3 py-2 text-sm text-black/62">
                <summary className="cursor-pointer font-bold">还有 {hiddenFallbackCount} 个备选方案</summary>
                <div className="mt-2 space-y-2">
                  {fallbackPlans.slice(1).map((plan) => (
                    <div key={plan.id} className="rounded-md bg-meituan-gray px-3 py-2 text-xs">
                      <span className="font-bold">{plan.title}</span>
                      <span className="ml-2">等待 {plan.totalWaitMinutes}m / 预算 {plan.totalBudget} 元</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
