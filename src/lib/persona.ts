import type { ParseResult } from "@/lib/types";

export type PersonaType = "friends" | "family" | "date" | "work" | "errand" | "casual";

export type SlotTypeKey = "activity" | "food" | "extra";

export type PersonaConfig = {
  label: string;
  summary: string;
  tags: string[];
  planTitle: string;
  bestPlanReasons: string[];
  poiReason: string;
  availabilityHint: string;
  routeLinkHint: string;
  slotLabels: Record<SlotTypeKey, string>;
  fallbackReason: string;
};

export const GENERIC_PLAN_TITLE = "本地短时成行方案";

export const personaConfigs: Record<PersonaType, PersonaConfig> = {
  friends: {
    label: "朋友聚会",
    summary: "AI 识别：朋友聚会 · 晚饭+饭后聊天 · 交通方便优先 · 尽量少排队",
    tags: ["晚饭", "聊天", "少排队"],
    planTitle: "朋友聚会优先方案",
    bestPlanReasons: ["适合聊天和集合", "饭后还能续摊", "尽量降低排队风险"],
    poiReason: "更适合聊天和朋友集合",
    availabilityHint: "优先看集合方便、排队可控的时段",
    routeLinkHint: "与晚饭和续摊节点衔接更顺",
    slotLabels: {
      activity: "先集合 / 轻活动",
      food: "晚饭",
      extra: "饭后聊天 / 续摊",
    },
    fallbackReason: "这个备选离集合点更近，减少等人",
  },
  family: {
    label: "家庭亲子",
    summary: "AI 识别：家庭亲子 · 少转场 · 等待短 · 亲子友好优先",
    tags: ["少转场", "等待短", "亲子友好"],
    planTitle: "家庭亲子少转场方案",
    bestPlanReasons: ["少转场，带孩子不折腾", "室内优先，等待更短", "餐饮节点更亲子友好"],
    poiReason: "更适合带孩子，减少等待和转场",
    availabilityHint: "优先室内、可预订、排队短的节点",
    routeLinkHint: "转场少，适合家庭半日节奏",
    slotLabels: {
      activity: "亲子活动",
      food: "少转场餐厅",
      extra: "室内停留 / 休息点",
    },
    fallbackReason: "这个备选转场更少，更适合带孩子",
  },
  date: {
    label: "轻松约会",
    summary: "AI 识别：轻松约会 · 氛围感 · 饭后活动 · 路线舒适",
    tags: ["氛围感", "饭后活动", "路线舒适"],
    planTitle: "轻松约会方案",
    bestPlanReasons: ["氛围更轻松", "路线舒适，不赶", "饭后可接甜品或散步"],
    poiReason: "氛围更轻松，适合约会和饭后停留",
    availabilityHint: "优先氛围稳定、等待不长的时段",
    routeLinkHint: "饭后可自然接散步或甜品",
    slotLabels: {
      activity: "展览 / 散步",
      food: "氛围餐厅",
      extra: "甜品 / 咖啡",
    },
    fallbackReason: "这个备选氛围稍弱，但排队风险更低",
  },
  work: {
    label: "工作学习",
    summary: "AI 识别：工作学习 · 安静久坐 · 有插座 · 避开网红高峰",
    tags: ["安静", "久坐", "有插座"],
    planTitle: "工作学习安静方案",
    bestPlanReasons: ["更安静，可久坐", "有插座 / 低打扰", "减少转场对准备时间的打断"],
    poiReason: "更安静，适合学习 / 办公 / 面试准备",
    availabilityHint: "优先低打扰、可久坐、插座充足的时段",
    routeLinkHint: "节点紧凑，少打断准备时间",
    slotLabels: {
      activity: "安静空间",
      food: "简餐 / 咖啡",
      extra: "面试 / 学习准备缓冲",
    },
    fallbackReason: "这个备选等待更短，不压缩准备时间",
  },
  errand: {
    label: "顺路办事",
    summary: "AI 识别：顺路办事 · 少绕路 · 时间窗口可控 · 顺路衔接",
    tags: ["少绕路", "控时间", "顺路衔接"],
    planTitle: "顺路办事方案",
    bestPlanReasons: ["顺路衔接，不绕路", "时间窗口可控", "先办事再安排停留或用餐"],
    poiReason: "更适合顺路衔接，减少绕行",
    availabilityHint: "优先途经点开放、等待可控的时段",
    routeLinkHint: "先办事再停留，动线更顺",
    slotLabels: {
      activity: "先办事 / 拿东西 / 接人",
      food: "附近停留",
      extra: "晚饭",
    },
    fallbackReason: "这个备选更顺路，方便先办事再停留或用餐",
  },
  casual: {
    label: "临时放松",
    summary: "AI 识别：临时放松 · 不赶时间 · 附近优先 · 选择灵活",
    tags: ["不赶时间", "附近优先", "选择灵活"],
    planTitle: "临时放松方案",
    bestPlanReasons: ["附近优先", "不需要强计划", "可根据排队和心情灵活替换"],
    poiReason: "适合临时有空、附近优先且选择灵活",
    availabilityHint: "附近开放即可，不强调精确时段",
    routeLinkHint: "节点可替换，收尾更灵活",
    slotLabels: {
      activity: "附近轻松活动",
      food: "可替换餐饮",
      extra: "灵活收尾",
    },
    fallbackReason: "这个备选更灵活，适合按排队、天气或心情随时替换",
  },
};

const genericPersonaConfig: PersonaConfig = {
  label: "本地出行",
  summary: "AI 识别：本地短时成行 · 综合时间、距离与排队风险",
  tags: ["附近优先", "综合规划"],
  planTitle: GENERIC_PLAN_TITLE,
  bestPlanReasons: ["综合时间、距离和排队风险", "节点衔接尽量顺畅", "可根据现场情况微调"],
  poiReason: "适合本地短时成行，综合可行性较高",
  availabilityHint: "优先当前开放、等待较短的节点",
  routeLinkHint: "按当前路线顺序衔接各节点",
  slotLabels: {
    activity: "活动",
    food: "用餐",
    extra: "饭后活动",
  },
  fallbackReason: "这个备选更稳妥，可按现场情况切换",
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

export function getPersonaConfig(parseResult: ParseResult): PersonaConfig {
  const type = inferPersona(parseResult);
  return personaConfigs[type] ?? genericPersonaConfig;
}

export function getPersonaSlotLabel(parseResult: ParseResult, slotType: SlotTypeKey): string {
  const labels = getPersonaConfig(parseResult).slotLabels;
  return labels[slotType] ?? genericPersonaConfig.slotLabels[slotType];
}

export function getFallbackPersonaReason(parseResult: ParseResult): string {
  return getPersonaConfig(parseResult).fallbackReason;
}
