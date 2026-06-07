import type { ParseResult } from "@/lib/types";

type PersonaType = "friends" | "family" | "date" | "work" | "errand" | "casual";

type PersonaConfig = {
  label: string;
  summary: string;
  tags: string[];
};

type TripPersonaCardProps = {
  parseResult?: ParseResult;
};

const personaConfigs: Record<PersonaType, PersonaConfig> = {
  friends: {
    label: "朋友聚会",
    summary: "AI 识别：朋友聚会 · 晚饭+饭后聊天 · 交通方便优先 · 尽量少排队",
    tags: ["晚饭", "聊天", "少排队"],
  },
  family: {
    label: "家庭亲子",
    summary: "AI 识别：家庭亲子 · 少转场 · 等待短 · 亲子友好优先",
    tags: ["少转场", "等待短", "亲子友好"],
  },
  date: {
    label: "轻松约会",
    summary: "AI 识别：轻松约会 · 氛围感 · 饭后活动 · 路线舒适",
    tags: ["氛围感", "饭后活动", "路线舒适"],
  },
  work: {
    label: "工作学习",
    summary: "AI 识别：工作学习 · 安静久坐 · 有插座 · 避开网红高峰",
    tags: ["安静", "久坐", "有插座"],
  },
  errand: {
    label: "顺路办事",
    summary: "AI 识别：顺路办事 · 少绕路 · 时间窗口可控 · 顺路衔接",
    tags: ["少绕路", "控时间", "顺路衔接"],
  },
  casual: {
    label: "临时放松",
    summary: "AI 识别：临时放松 · 不赶时间 · 附近优先 · 选择灵活",
    tags: ["不赶时间", "附近优先", "选择灵活"],
  },
};

const keywordRules: Array<{ type: PersonaType; words: string[] }> = [
  { type: "errand", words: ["先去", "拿东西", "接人", "途经", "顺路", "学校"] },
  { type: "family", words: ["孩子", "亲子", "家人", "老婆", "老公", "带娃", "家庭"] },
  { type: "friends", words: ["朋友", "聚会", "聊天", "一起吃饭", "饭后"] },
  { type: "work", words: ["学习", "办公", "面试", "安静", "插座", "坐两小时", "久坐"] },
  { type: "date", words: ["约会", "情侣", "氛围", "散步", "甜品", "展览"] },
  { type: "casual", words: ["有空", "随便逛逛", "轻松活动", "安排一下", "几个小时"] },
];

function countMatches(text: string, words: string[]) {
  return words.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
}

function inferFromSemantic(parseResult: ParseResult): PersonaType {
  const intent = parseResult.intent;
  const dims = intent.semantic?.dims;
  if (intent.needTags.includes("亲子")) return "family";
  if (intent.needTags.includes("安静") && intent.preferQuiet && (dims?.activityFirst ?? 0.5) < 0.45) return "work";
  if (intent.needTags.includes("散步") || intent.needTags.includes("展览")) return "date";
  if ((dims?.activityFirst ?? 0.5) > 0.58) return "casual";
  return "casual";
}

function inferPersona(parseResult: ParseResult): PersonaType {
  const intent = parseResult.intent;
  const text = `${intent.rawGoal} ${intent.wechatConstraint} ${intent.seedContent}`;
  const scored = keywordRules
    .map((rule) => ({ type: rule.type, score: countMatches(text, rule.words) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.type ?? inferFromSemantic(parseResult);
}

export function TripPersonaCard({ parseResult }: TripPersonaCardProps) {
  if (!parseResult) return null;

  const persona = inferPersona(parseResult);
  const config = personaConfigs[persona];

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
