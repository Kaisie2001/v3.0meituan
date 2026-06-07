import type { RoutePlan } from "./types";

export function mockExecute(routePlan: RoutePlan) {
  return [
    `${routePlan.cafe?.name ?? "推荐咖啡馆"} 咖啡套餐已锁定`,
    `${routePlan.restaurant?.name ?? "推荐餐厅"} 17:00 双人位已预订`,
    "路线已生成",
    "计划已发送给朋友",
  ];
}
