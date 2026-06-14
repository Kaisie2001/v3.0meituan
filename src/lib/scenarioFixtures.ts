import type { RoutePriorityChoice, TravelSettings } from "./preferenceSummary";

export type ScenarioFixtureId =
  | "friendsEvening"
  | "familyWeekend"
  | "workAfternoon"
  | "dateEvening"
  | "errandAfternoon"
  | "rushTaxi";

export type ScenarioExpectedAssertion = {
  /** Human-readable behavior expectation for docs and integration checks. */
  description: string;
  /** Optional keyword to match in helper output (persona tags, effects, planning signals). */
  keyword?: string;
};

export type ScenarioFixture = {
  id: ScenarioFixtureId;
  label: string;
  goal: string;
  wechat: string;
  seed: string;
  travelSettings: TravelSettings;
  /** Persona keywords — may include aliases like "social" for friends. */
  expectedPersonaHints: string[];
  /** Risk themes this scenario is designed to surface. */
  expectedRiskHints: string[];
  expectedRoutePriority: RoutePriorityChoice;
  expectedBehavior: string;
  expectedAssertions: ScenarioExpectedAssertion[];
};

export const scenarioFixtures: ScenarioFixture[] = [
  {
    id: "friendsEvening",
    label: "朋友晚间聚会",
    goal: "晚上和朋友吃饭，吃完想找地方聊天，人均150以内",
    wechat: "朋友不吃辣，最好地铁方便，能订座更好。",
    seed: "",
    travelSettings: {
      date: "today",
      startTime: "18:30",
      duration: "3h",
      transportMode: "transit",
      routePriority: "queue",
      partySize: 4,
      budget: 150,
      maxCommute: 30,
    },
    expectedPersonaHints: ["friends", "social"],
    expectedRiskHints: ["queue", "booking"],
    expectedRoutePriority: "queue",
    expectedBehavior: "应出现排队风险和备选方案",
    expectedAssertions: [
      { description: "识别为朋友聚会场景", keyword: "朋友" },
      { description: "晚高峰排队风险应被提及", keyword: "排队" },
      { description: "应生成备选方案", keyword: "备选" },
    ],
  },
  {
    id: "familyWeekend",
    label: "周末家庭亲子",
    goal: "周末下午带孩子出去玩3小时，别太累，通勤30分钟内",
    wechat: "带孩子，室内优先，别排队太久。",
    seed: "周末亲子好去处",
    travelSettings: {
      date: "saturday",
      startTime: "14:00",
      duration: "3h",
      transportMode: "auto",
      routePriority: "distance",
      partySize: 3,
      budget: 120,
      maxCommute: 30,
    },
    expectedPersonaHints: ["family"],
    expectedRiskHints: ["walking", "transfer"],
    expectedRoutePriority: "distance",
    expectedBehavior: "应强调亲子友好、少转场",
    expectedAssertions: [
      { description: "识别为亲子场景", keyword: "亲子" },
      { description: "应强调少转场", keyword: "转场" },
      { description: "下午时段风险相对稳定", keyword: "下午" },
    ],
  },
  {
    id: "workAfternoon",
    label: "下午工作学习",
    goal: "我下午要准备面试，想找个安静能坐两小时的地方",
    wechat: "需要安静、有插座，别太远。",
    seed: "",
    travelSettings: {
      date: "today",
      startTime: "14:00",
      duration: "3h",
      transportMode: "transit",
      routePriority: "detour",
      partySize: 1,
      budget: 80,
      maxCommute: 30,
    },
    expectedPersonaHints: ["work", "quiet"],
    expectedRiskHints: ["noise", "seat availability"],
    expectedRoutePriority: "detour",
    expectedBehavior: "应强调安静、久坐、低打扰",
    expectedAssertions: [
      { description: "识别为工作/学习场景", keyword: "安静" },
      { description: "应强调久坐需求", keyword: "久坐" },
      { description: "顺路规划信号存在", keyword: "顺路" },
    ],
  },
  {
    id: "dateEvening",
    label: "轻松约会",
    goal: "今天想安排一个轻松约会，吃饭加饭后散步",
    wechat: "氛围好一点，别太吵，饭后可以慢慢走。",
    seed: "",
    travelSettings: {
      date: "today",
      startTime: "17:30",
      duration: "4h",
      transportMode: "walking",
      routePriority: "experience",
      partySize: 2,
      budget: 200,
      maxCommute: 25,
    },
    expectedPersonaHints: ["date"],
    expectedRiskHints: ["queue", "weather", "walking"],
    expectedRoutePriority: "experience",
    expectedBehavior: "应强调氛围、饭后安排",
    expectedAssertions: [
      { description: "识别为约会场景", keyword: "约会" },
      { description: "应强调氛围体验", keyword: "氛围" },
      { description: "步行优先指引存在", keyword: "步行" },
    ],
  },
  {
    id: "errandAfternoon",
    label: "顺路办事下午",
    goal: "我先去学校拿东西，再找地方坐坐，晚上和朋友吃饭",
    wechat: "中间想找个地方坐，晚上和朋友吃饭，别绕太多路。",
    seed: "学校附近",
    travelSettings: {
      date: "today",
      startTime: "16:30",
      duration: "4h",
      transportMode: "walking",
      routePriority: "detour",
      partySize: 2,
      budget: 150,
      maxCommute: 30,
    },
    expectedPersonaHints: ["errand"],
    expectedRiskHints: ["detour"],
    expectedRoutePriority: "detour",
    expectedBehavior: "应强调顺路、少折返",
    expectedAssertions: [
      { description: "识别为顺路办事场景", keyword: "顺路" },
      { description: "少绕路规划信号存在", keyword: "绕路" },
      { description: "步行紧凑路线指引", keyword: "步行" },
    ],
  },
  {
    id: "rushTaxi",
    label: "晚高峰快速转场",
    goal: "我晚上只有两小时，想快速吃个饭再去下一个地方",
    wechat: "时间紧，别排队，尽快转场。",
    seed: "",
    travelSettings: {
      date: "today",
      startTime: "19:00",
      duration: "2h",
      transportMode: "driving",
      routePriority: "time",
      partySize: 2,
      budget: 150,
      maxCommute: 25,
    },
    expectedPersonaHints: ["casual", "rush"],
    expectedRiskHints: ["traffic", "time"],
    expectedRoutePriority: "time",
    expectedBehavior: "应强调压缩转场时间，不应一直显示步行优先",
    expectedAssertions: [
      { description: "时间压缩规划信号", keyword: "转场" },
      { description: "驾车/打车指引存在", keyword: "驾车" },
      { description: "不应强调全程步行", keyword: "全程步行" },
    ],
  },
];

export function getScenarioFixture(id: string): ScenarioFixture | undefined {
  return scenarioFixtures.find((fixture) => fixture.id === id);
}
