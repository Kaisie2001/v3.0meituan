"use client";

import { defaultInputs } from "@/lib/parseIntent";

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
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-black/55">GoMap Agent</p>
          <h1 className="text-3xl font-bold tracking-normal text-meituan-ink">美团成行地图</h1>
        </div>
        <div className="grid gap-1 text-sm text-black/70 md:grid-cols-3">
          <span>不是按评分推荐，而是按本次需求适配度推荐。</span>
          <span>不是只算最短路，而是算少等待、少绕路、可履约的路线。</span>
          <span>不是只展示 POI，而是生成可执行的本地生活方案。</span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-black/70">自然语言目标</span>
          <textarea
            className="h-28 w-full resize-none rounded-lg border border-black/10 bg-meituan-gray p-3 text-sm leading-6 outline-none transition focus:border-meituan-yellow focus:bg-white"
            value={goal}
            onChange={(event) => onGoalChange(event.target.value)}
            placeholder={defaultInputs.goal}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-black/70">微信约束补充</span>
          <textarea
            className="h-28 w-full resize-none rounded-lg border border-black/10 bg-meituan-gray p-3 text-sm leading-6 outline-none transition focus:border-meituan-yellow focus:bg-white"
            value={wechat}
            onChange={(event) => onWechatChange(event.target.value)}
            placeholder={defaultInputs.wechat}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-black/70">种草内容补充</span>
          <textarea
            className="h-28 w-full resize-none rounded-lg border border-black/10 bg-meituan-gray p-3 text-sm leading-6 outline-none transition focus:border-meituan-yellow focus:bg-white"
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
          {loading ? "生成中..." : "生成成行地图"}
        </button>
      </div>
    </section>
  );
}
