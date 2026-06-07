const steps = ["理解需求", "查找附近地点", "分析评价证据", "检查排队/可订", "计算路线", "生成方案"];

type AgentStepperProps = {
  activeStep: number;
  completed: boolean;
};

export function AgentStepper({ activeStep, completed }: AgentStepperProps) {
  return (
    <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">AI 规划进度</h2>
        <span className="rounded-full bg-meituan-yellow/25 px-3 py-1 text-xs font-semibold text-black/70">
          {completed ? "方案已生成" : "模拟推理中"}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {steps.map((step, index) => {
          const done = completed || index < activeStep;
          const active = !completed && index === activeStep;
          return (
            <div
              className={`rounded-lg border p-3 transition ${
                done
                  ? "border-emerald-200 bg-emerald-50"
                  : active
                    ? "border-meituan-yellow bg-yellow-50"
                    : "border-black/10 bg-meituan-gray"
              }`}
              key={step}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                    done ? "bg-emerald-500 text-white" : active ? "bg-meituan-yellow text-black" : "bg-white text-black/45"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span className="text-sm font-semibold text-black/75">{step}</span>
              </div>
              {active ? <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/10"><div className="h-full w-2/3 animate-pulse rounded-full bg-meituan-yellow" /></div> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
