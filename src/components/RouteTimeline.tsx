import type { RoutePlan } from "@/lib/types";

type RouteTimelineProps = {
  routePlan?: RoutePlan;
};

export function RouteTimeline({ routePlan }: RouteTimelineProps) {
  if (!routePlan) {
    return (
      <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft">
        <h2 className="text-lg font-bold">路线计划</h2>
        <p className="mt-2 text-sm text-black/58">点击生成后，将展示可执行路线。</p>
      </section>
    );
  }

  const fallbackPlans = routePlan.fallbackPlans ?? [];
  const mainSlots = routePlan.mainPlan?.slots ?? [];

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

      <div className="grid gap-3 sm:grid-cols-4">
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
            {fallbackPlans.map((plan) => (
              <div key={plan.id} className="rounded-lg bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-black/80">{plan.title}</p>
                    {plan.trigger ? <p className="mt-1 text-xs text-black/55">触发：{plan.trigger}</p> : null}
                  </div>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-bold text-black/60">
                    等待 {plan.totalWaitMinutes}m / 预算 {plan.totalBudget} 元
                  </span>
                </div>
                {plan.diffFromMain ? (
                  <div className="mt-2 text-xs text-black/55">
                    对比主方案：预算 {plan.diffFromMain.deltaBudget >= 0 ? "+" : ""}{plan.diffFromMain.deltaBudget} 元 / 等待{" "}
                    {plan.diffFromMain.deltaWaitMinutes >= 0 ? "+" : ""}{plan.diffFromMain.deltaWaitMinutes}m / 通勤{" "}
                    {plan.diffFromMain.deltaCommuteMinutes >= 0 ? "+" : ""}{plan.diffFromMain.deltaCommuteMinutes}m
                  </div>
                ) : null}
                <div className="mt-3 space-y-2">
                  {plan.steps.slice(1, 3).map((step) => (
                    <div key={`${plan.id}-${step.time}-${step.title}`} className="rounded-md bg-meituan-gray px-3 py-2 text-xs text-black/70">
                      <span className="font-bold text-black/75">{step.title}</span>
                      <span className="ml-2">{step.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
