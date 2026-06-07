import type { ParseResult } from "@/lib/types";

export type PersonaType = "friends" | "family" | "date" | "work" | "errand" | "casual";

export type PersonaConfig = {
  label: string;
  summary: string;
  tags: string[];
  planTitle: string;
  bestPlanReasons: string[];
  poiReason: string;
};

export const personaConfigs: Record<PersonaType, PersonaConfig> = {
  friends: {
    label: "朋友聚会",
    summary: "AI 识别：朋友聚会 · 晚饭+饭后聊天 · 交通方便优先 · 尽量少排队",
    tags: ["晚饭", "聊天", "少排队"],
    planTitle: "朋友聚会优先方案",
    bestPlanReasons: ["适合聊天，环境不过分嘈杂", "交通和集合方便，减少大家等人的时间", "饭后附近还能接咖啡/商场/散步，方便续摊"],
    poiReason: "适合朋友聊天或饭后续摊，临时聚会不用强计划",
  },
  family: {
    label: "家庭亲子",
    summary: "AI 识别：家庭亲子 · 少转场 · 等待短 · 亲子友好优先",
    tags: ["少转场", "等待短", "亲子友好"],
    planTitle: "家庭亲子少转场方案",
    bestPlanReasons: ["少转场，避免带孩子来回折腾", "等待时间短，降低孩子无聊或疲惫风险", "室内/商场节点更适合家庭半日活动"],
    poiReason: "更适合家庭同行，优先减少转场和等待压力",
  },
  date: {
    label: "轻松约会",
    summary: "AI 识别：轻松约会 · 氛围感 · 饭后活动 · 路线舒适",
    tags: ["氛围感", "饭后活动", "路线舒适"],
    planTitle: "轻松约会氛围方案",
    bestPlanReasons: ["氛围更轻松，适合聊天和停留", "路线舒适，饭后可接甜品/散步", "节奏不赶，更适合约会体验"],
    poiReason: "氛围更轻松，适合聊天、停留和饭后散步",
  },
  work: {
    label: "工作学习",
    summary: "AI 识别：工作学习 · 安静久坐 · 有插座 · 避开网红高峰",
    tags: ["安静", "久坐", "有插座"],
    planTitle: "工作学习安静久坐方案",
    bestPlanReasons: ["更安静，适合学习/办公/面试准备", "有插座/久坐/低打扰等场景证据", "路线简单，减少准备时间被打断"],
    poiReason: "更安静，适合学习、办公或面试前准备",
  },
  errand: {
    label: "顺路办事",
    summary: "AI 识别：顺路办事 · 少绕路 · 时间窗口可控 · 顺路衔接",
    tags: ["少绕路", "控时间", "顺路衔接"],
    planTitle: "顺路办事少绕路方案",
    bestPlanReasons: ["更顺路，减少绕行", "能和接人/拿东西/途经点衔接", "适合先办事再安排停留或用餐"],
    poiReason: "更适合顺路衔接，减少办事前后的绕行成本",
  },
  casual: {
    label: "临时放松",
    summary: "AI 识别：临时放松 · 不赶时间 · 附近优先 · 选择灵活",
    tags: ["不赶时间", "附近优先", "选择灵活"],
    planTitle: "轻松半日成行",
    bestPlanReasons: ["节奏轻松，不需要强计划", "附近优先，降低决策成本", "可根据排队/天气/心情灵活替换"],
    poiReason: "适合临时有空快速成行，附近优先且选择灵活",
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

export function inferPersona(parseResult: ParseResult): PersonaType {
  const intent = parseResult.intent;
  const text = `${intent.rawGoal} ${intent.wechatConstraint} ${intent.seedContent}`;
  const scored = keywordRules
    .map((rule) => ({ type: rule.type, score: countMatches(text, rule.words) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.type ?? inferFromSemantic(parseResult);
}

export function getPersonaConfig(parseResult: ParseResult) {
  return personaConfigs[inferPersona(parseResult)];
}
