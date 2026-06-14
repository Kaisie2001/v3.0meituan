# 项目状态 · meituan-gomap-agent-demo

> 最后更新：Demo Readiness（Step 6B）  
> 分支参考：`chore/demo-readiness`

---

## 1. 项目定位

**美团本地生活短时活动规划 Agent Demo**（Web / 390px 移动端体验）

用户输入一句自然语言目标 → 结合出行设置 → 生成 **主方案 + 备选方案** → 地图联动 → 模拟 **订座/执行/转发**。

---

## 2. 已完成能力

### 2.1 核心链路

| 能力 | 实现位置 | 说明 |
|------|---------|------|
| 意图解析 | `RuleBasedParser`, `parseIntent` | 规则 + 语义哈希，无 LLM 请求 |
| Agent 管线 | `runAgent` | Parse → Score → Plan → ExecuteActions |
| 路线规划 | `planRoute` | 主方案 + 备选 + slot/steps |
| POI 评分 | `scorePoi` | 场景匹配、排队、预算、路线衔接 |
| 出行设置后处理 | `applyTravelSettingsToPlan` | 不重跑 Agent，调整排序/节点/备选 |
| 执行模拟 | `executePlan`, `mockTools` | Mock 订位/下单/trace/凭证 |

### 2.2 体验与 UI

| 能力 | 说明 |
|------|------|
| 首页 | 自然语言输入、出行偏好 Sheet、5 个快捷场景 |
| 出行设置 | 时间 / 交通 / 路线优先级 / 人数预算 |
| 结果页 | 地图 Hero + Bottom Sheet（主方案 / 备选 / 推荐点） |
| 规划依据 | 「为什么这样排？」折叠、路线三步、出行指引 |
| 执行页 | 完成态凭证卡、转发文案、折叠 trace |
| 状态机 | `appFlowMachine` 管理 screen / tab / 备选 / 执行 |

### 2.3 地图

| 能力 | 说明 |
|------|------|
| 底图 | Leaflet + OpenStreetMap（多镜像 fallback） |
| 呈现逻辑 | `mapPresentation`：高亮路线、备选点、dim、hint |
| 交互 | 点击 POI 切换推荐点详情 |

### 2.4 测试与基准

| 类型 | 数量 | 位置 |
|------|------|------|
| 单元/集成 | 75 | `src/__tests__/` |
| E2E 黄金路径 | 4 | `e2e/golden-paths.spec.ts` |
| 场景 Fixture | 6 | `src/lib/scenarioFixtures.ts` |
| Demo 场景 | 5 | `src/lib/demoScenarios.ts` |

**命令：**

```bash
npm run test       # vitest
npm run test:e2e   # playwright @ 127.0.0.1:3100
npm run build      # next build (static export)
```

---

## 3. 仍是 Mock 的部分

| 模块 | 现状 | 数据/工具来源 |
|------|------|--------------|
| POI 库 | 固定 mock 数据集 | `mockPois.ts` |
| 排队/可订/ETA | 字段模拟 | `mockTools`, POI 属性 |
| 意图 LLM | 接口占位，不发请求 | `LLMParserStub.ts` |
| 地图路径 | 示意折线，非真实导航 | `mapPresentation`, Leaflet |
| 执行/订座 | Mock trace + 凭证 UI | `executePlan`, `BookingVoucherCard` |
| 微信/种草 | 文本注入解析，无真实 IM | `parseIntent` wechat/seed |

---

## 4. 后续可接入方向（不改 UI 主流程）

| 优先级 | 方向 | 建议接入点 |
|--------|------|-----------|
| P0 | 点评/美团 POI 搜索 | 替换 `mockTools.search` / POI 源 |
| P0 | 真实 ETA / 路径 | 地图路径服务 + `routeEtaMinutes` |
| P1 | 订座 / 团购 API | `executePlan` 中 ReserveTable / PlaceOrder |
| P1 | LLM 意图解析 | `LLMParserStub` → 真实 Parser，保留 `ParseResult` 契约 |
| P2 | 用户画像 / LBS | `persona`, `travelSettings` 个性化 |
| P2 | 实时排队 | 动态更新 `queueMinutes`, `travelSettingEffects` |

原则：**保持 `runAgent` 返回结构、`AppFlowState`、Sheet Tab 不变**，替换底层 tool 实现。

---

## 5. 已知限制（Demo 预期内）

- README 部分描述与当前 UI 不完全一致（以本文件为准）
- OSM 瓦片在部分网络下加载失败，有降级提示
- 「我不喜欢」重算在 details 流，主结果 Sheet 以当前设计为准
- 出行设置变更在结果页走后处理，非全量重跑 Agent（by design）

---

## 6. Demo 就绪状态

| 检查项 | 状态 |
|--------|------|
| `npm run test` | ✅ 75/75 |
| `npm run test:e2e` | ✅ 4/4 |
| `npm run build` | ✅ |
| 人工清单 | `DEMO_CHECKLIST.md` |
| 演示话术 | `DEMO_SCRIPT.md` |
| 核心路径 E2E | 顺路办事 / 朋友备选 / 工作推荐点 |

**结论：当前版本可稳定对外 Demo。**

---

## 7. 相关文档

- `DEMO_CHECKLIST.md` — 交付前人工验收
- `DEMO_SCRIPT.md` — 2 分钟演示话术
- `HANDOFF.md` — 历史交接与技术细节
- `README.md` — 本地运行说明
