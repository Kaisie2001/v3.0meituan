"use client";

import { useState } from "react";
import { defaultInputs } from "@/lib/parseIntent";

const exampleGoals = [
  "今天下午2点有3小时空，帮我安排一个轻松活动，通勤30分钟内",
  "今天晚上6点和朋友吃饭，吃完想找地方聊天，人均150以内",
  "周六下午2点带孩子出去玩3小时，别太累，通勤30分钟内",
  "今天下午4点有3小时空，先去学校拿东西，再找地方坐坐，晚上和朋友吃饭，通勤30分钟内",
];

type InputPanelProps = {
  goal: string;
  wechat: string;
  seed: string;
  loading: boolean;
  timeSummary: string;
  onGoalChange: (value: string) => void;
  onWechatChange: (value: string) => void;
  onSeedChange: (value: string) => void;
  onOpenTimePicker: () => void;
  onGenerate: () => void;
  onOpenRoutePreferences?: () => void;
  hasRoutePreferences?: boolean;
};

export function InputPanel({
  goal,
  wechat,
  seed,
  loading,
  timeSummary,
  onGoalChange,
  onWechatChange,
  onSeedChange,
  onOpenTimePicker,
  onGenerate,
  onOpenRoutePreferences,
  hasRoutePreferences,
}: InputPanelProps) {
  const [wechatOpen, setWechatOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const hasWechat = wechat.trim().length > 0;
  const hasSeed = seed.trim().length > 0;

  return (
    <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft">
      <div className="mb-4">
        <div>
          <p className="text-sm font-semibold text-black/55">GoMap Agent</p>
          <h1 className="text-2xl font-bold tracking-normal text-meituan-ink">美团成行地图</h1>
          <p className="mt-2 text-base font-semibold text-black/70">一句话，让 AI 帮你安排本地短时活动</p>
          <p className="mt-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs font-semibold leading-5 text-black/58">
            试试：点击示例需求，AI 会自动生成成行方案并模拟完成预订/下单。
          </p>
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

      <div className="grid gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-black/75">你今天想怎么安排？</span>
          <textarea
            className="h-28 w-full resize-none rounded-lg border border-black/10 bg-meituan-gray p-3 text-sm leading-6 outline-none transition focus:border-meituan-yellow focus:bg-white"
            value={goal}
            onChange={(event) => onGoalChange(event.target.value)}
            placeholder="比如：想找个地方轻松待一下，晚点和朋友吃饭"
          />
        </label>

        <button
          type="button"
          onClick={onOpenTimePicker}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-black/8 bg-meituan-gray/50 px-3 py-2.5 text-left transition hover:border-meituan-yellow/60 hover:bg-yellow-50/40"
        >
          <span className="min-w-0">
            <span className="block text-xs font-bold text-black/45">出行时间</span>
            <span className="mt-0.5 block truncate text-sm font-extrabold text-meituan-ink">{timeSummary}</span>
          </span>
          <span className="shrink-0 text-xs font-bold text-meituan-ink">修改</span>
        </button>

        <button
          className="h-12 w-full rounded-lg bg-meituan-yellow px-6 text-sm font-bold text-meituan-ink shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:justify-self-start"
          type="button"
          disabled={loading}
          onClick={() => onGenerate?.()}
        >
          {loading ? "规划中..." : "一键 AI 规划"}
        </button>
        {onOpenRoutePreferences ? (
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-black/8 bg-white px-3 py-2.5 text-left transition hover:border-meituan-yellow/50 hover:bg-yellow-50/40 sm:w-auto"
            onClick={() => onOpenRoutePreferences?.()}
          >
            <span>
              <span className="block text-sm font-bold text-black/75">设置出行偏好</span>
              <span className="mt-0.5 block text-xs text-black/50">出行方式、路线优先级、时间与人均预算</span>
            </span>
            <span className="shrink-0 text-xs font-bold text-meituan-ink">{hasRoutePreferences ? "已设置" : "去设置"}</span>
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-black/8 bg-meituan-gray/60">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            onClick={() => setWechatOpen((open) => !open)}
            aria-expanded={wechatOpen}
          >
            <span>
              <span className="block text-sm font-extrabold text-black/78">添加朋友/家人要求</span>
              <span className="mt-1 block text-xs leading-5 text-black/50">例如不吃辣、别太远、预算、人群偏好等</span>
              {hasWechat ? <span className="mt-1 inline-block text-xs font-bold text-emerald-700">已添加朋友要求</span> : null}
            </span>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-black/60 shadow-sm">
              {wechatOpen ? "收起" : "+ 展开"}
            </span>
          </button>
          {wechatOpen ? (
            <div className="px-4 pb-4">
              <textarea
                className="h-28 w-full resize-none rounded-lg border border-black/8 bg-white p-3 text-sm leading-6 text-black/70 outline-none transition placeholder:text-black/35 focus:border-meituan-yellow"
                value={wechat}
                onChange={(event) => onWechatChange(event.target.value)}
                placeholder={defaultInputs.wechat}
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-black/8 bg-meituan-gray/60">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            onClick={() => setSeedOpen((open) => !open)}
            aria-expanded={seedOpen}
          >
            <span>
              <span className="block text-sm font-extrabold text-black/78">添加种草地点/收藏内容</span>
              <span className="mt-1 block text-xs leading-5 text-black/50">例如收藏的店、想去清单、朋友推荐地点等</span>
              {hasSeed ? <span className="mt-1 inline-block text-xs font-bold text-emerald-700">已添加种草内容</span> : null}
            </span>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-black/60 shadow-sm">
              {seedOpen ? "收起" : "+ 展开"}
            </span>
          </button>
          {seedOpen ? (
            <div className="px-4 pb-4">
              <textarea
                className="h-28 w-full resize-none rounded-lg border border-black/8 bg-white p-3 text-sm leading-6 text-black/70 outline-none transition placeholder:text-black/35 focus:border-meituan-yellow"
                value={seed}
                onChange={(event) => onSeedChange(event.target.value)}
                placeholder={defaultInputs.seed}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
