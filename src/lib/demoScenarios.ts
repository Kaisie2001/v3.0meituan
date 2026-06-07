import { DEFAULT_TRAVEL_SETTINGS, type TravelSettings } from "./preferenceSummary";
import { defaultInputs } from "./parseIntent";

export type DemoScenarioId = "friends" | "family" | "date" | "work" | "errands";

export type DemoScenario = {
  id: DemoScenarioId;
  label: string;
  goal: string;
  wechat: string;
  seed: string;
  travelSettings: TravelSettings;
};

export const DEMO_DEFAULT_STATE = {
  goal: defaultInputs.goal,
  wechat: defaultInputs.wechat,
  seed: defaultInputs.seed,
  travelSettings: DEFAULT_TRAVEL_SETTINGS,
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "friends",
    label: "朋友聚会",
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
  },
  {
    id: "family",
    label: "家庭亲子",
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
  },
  {
    id: "date",
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
  },
  {
    id: "work",
    label: "工作学习",
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
  },
  {
    id: "errands",
    label: "顺路办事",
    goal: "我先去学校拿东西，再找地方坐坐，晚上和朋友吃饭",
    wechat: "中间想找个地方坐，晚上和朋友吃饭，别绕太多路。",
    seed: "学校附近",
    travelSettings: {
      date: "today",
      startTime: "16:30",
      duration: "4h",
      transportMode: "auto",
      routePriority: "detour",
      partySize: 2,
      budget: 150,
      maxCommute: 30,
    },
  },
];

export function getDemoScenarioById(id: DemoScenarioId) {
  return DEMO_SCENARIOS.find((scenario) => scenario.id === id);
}
