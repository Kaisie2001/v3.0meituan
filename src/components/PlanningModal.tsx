"use client";

const planningSteps = [
  "正在理解你的需求",
  "正在筛选附近地点",
  "正在检查排队和可订状态",
  "正在生成最佳路线",
];

type PlanningModalProps = {
  open: boolean;
  step: number;
};

export function PlanningModal({ open, step }: PlanningModalProps) {
  if (!open) return null;

  const safeStep = Math.min(Math.max(step, 0), planningSteps.length - 1);

  return (
    <div className="pointer-events-auto absolute inset-0 z-[3000] flex items-end justify-center bg-black/35">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="planning-modal-title"
        className="mx-3 mb-0 flex max-h-[58%] w-[calc(100%-24px)] max-w-none flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-black/12" aria-hidden="true" />

        <div className="min-h-0 overflow-y-auto p-4">
          <div className="flex items-start gap-3">
            <div className="relative mt-0.5 h-9 w-9 shrink-0">
              <div className="absolute inset-0 rounded-full border-2 border-meituan-yellow/30" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-meituan-yellow" />
              <div className="absolute inset-2 rounded-full bg-meituan-yellow/20" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="planning-modal-title" className="text-base font-extrabold text-meituan-ink">
                AI 正在为你规划
              </h2>
              <p className="mt-1 text-sm leading-5 text-black/55">会综合距离、排队、可订和本次出行画像生成方案。</p>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-2">
            {planningSteps.map((_, index) => (
              <span
                key={planningSteps[index]}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === safeStep ? "w-6 bg-meituan-yellow" : index < safeStep ? "w-2 bg-meituan-yellow/50" : "w-2 bg-black/12"
                }`}
              />
            ))}
          </div>

          <ul className="mt-4 space-y-2">
            {planningSteps.map((label, index) => {
              const isActive = index === safeStep;
              const isDone = index < safeStep;
              return (
                <li
                  key={label}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    isActive ? "bg-meituan-yellow/15 font-bold text-meituan-ink" : isDone ? "text-black/45" : "text-black/30"
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      isDone ? "bg-emerald-500 text-white" : isActive ? "bg-meituan-yellow text-meituan-ink" : "bg-black/8 text-black/35"
                    }`}
                  >
                    {isDone ? "✓" : index + 1}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
