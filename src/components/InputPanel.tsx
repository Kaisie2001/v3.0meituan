"use client";

import { defaultInputs } from "@/lib/parseIntent";

const exampleGoals = [
  "今天下午有3小时空，帮我安排一个轻松活动",
  "晚上和朋友吃饭，吃完想找地方聊天",
  "周末带孩子出去玩几个小时，别太累",
  "我先去学校拿东西，再找地方坐坐，晚上和朋友吃饭",
];

type InputPanelProps = {
  goal: string;
  wechat: string;
  seed: string;
  loading: boolean;
  onGoalChange: (value: string) => void;
  onWechatChange: (value: string) => void;
  onSeedChange: (value: string) => void;
  onGenerate: () => void;
};

export function InputPanel({
  goal,
  wechat,
  seed,
  loading,
  onGoalChange,
  onWechatChange,
  onSeedChange,
  onGenerate,
}: InputPanelProps) {
  return (
    <section className="rounded-lg border border-black/5 bg-white p-5 shadow-soft">
      <div className="mb-5">
        <div>
          <p className="text-sm font-semibold text-black/55">GoMap Agent</p>
          <h1 className="text-3xl font-bold tracking-normal text-meituan-ink">美团成行地图</h1>
          <p className="mt-2 text-base font-semibold text-black/70">一句话，让 AI 帮你安排本地短时活动</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {exampleGoals.map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-full border border-black/8 bg-meituan-gray px-3 py-2 text-left text-xs font-semibold leading-5 text-black/68 transition hover:border-meituan-yellow hover:bg-yellow-50"
              onClick={() => onGoalChange(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-black/75">你今天想怎么安排？</span>
          <textarea
            className="h-28 w-full resize-none rounded-lg border border-black/10 bg-meituan-gray p-3 text-sm leading-6 outline-none transition focus:border-meituan-yellow focus:bg-white"
            value={goal}
            onChange={(event) => onGoalChange(event.target.value)}
            placeholder="比如：今天下午有3小时空，帮我安排一个轻松活动"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-black/50">可选：朋友/家人要求</span>
          <textarea
            className="h-28 w-full resize-none rounded-lg border border-black/8 bg-meituan-gray/70 p-3 text-sm leading-6 text-black/70 outline-none transition placeholder:text-black/35 focus:border-meituan-yellow focus:bg-white"
            value={wechat}
            onChange={(event) => onWechatChange(event.target.value)}
            placeholder={defaultInputs.wechat}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-black/50">可选：种草地点/收藏内容</span>
          <textarea
            className="h-28 w-full resize-none rounded-lg border border-black/8 bg-meituan-gray/70 p-3 text-sm leading-6 text-black/70 outline-none transition placeholder:text-black/35 focus:border-meituan-yellow focus:bg-white"
            value={seed}
            onChange={(event) => onSeedChange(event.target.value)}
            placeholder={defaultInputs.seed}
          />
        </label>
        <button
          className="h-12 rounded-lg bg-meituan-yellow px-6 text-sm font-bold text-meituan-ink shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={loading}
          onClick={onGenerate}
        >
          {loading ? "规划中..." : "一键 AI 规划"}
        </button>
      </div>
    </section>
  );
}
