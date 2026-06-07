## 交接说明（给接手同学）

### 项目目标

- 本地短时活动规划与执行 Agent Demo（Web UI）
- 支持任意自然语言输入：解析不充分时弹窗补全关键字段，再生成可执行方案
- 不接入付费 LLM：保留 LLM 接口占位，默认启发式解析
- 执行侧保留完整工具调用链路（Mock API + trace）用于产出凭证与文案，UI 仅展示结果与凭证
- 兼容“任意输入都会变化”：在未接入 LLM 时，用语义哈希画像兜底保证输出稳定可复现地变化
- “圆周旅迹式”联动：生成路线前先问答补齐路线偏好（出行方式/优化目标），地图展示规划折线；POI 点开才出详情；不喜欢可触发避开重算

### 运行环境

- Node.js 18+（建议 22 LTS）

### 当前已实现

- 通用解析结果（IntentDraft + missingFields + confidence + source）与执行 trace 类型：
  - `src/lib/types.ts`
- 启发式解析器（任意输入不崩，提取时间/时长/人数/通勤分钟/预算等）：
  - `src/lib/parsers/RuleBasedParser.ts`
- 语义哈希画像（任意输入稳定可复现地影响“需求理解/推荐/路线/文案”）：
  - `src/lib/semanticHash.ts`
  - `src/lib/parsers/RuleBasedParser.ts`
  - `src/lib/scorePoi.ts`
- LLM 占位解析器（接口存在但不发请求）：
  - `src/lib/parsers/LLMParserStub.ts`
- 弹窗问答补全（缺字段则弹窗确认）：
  - `src/components/ClarifyModal.tsx`
  - 页面逻辑：`src/app/page.tsx`
- 路线偏好问答（生成路线前弹窗问答；支持语音输入自定义目标）：
  - `src/components/RoutePreferenceModal.tsx`
  - 合并偏好：`src/lib/parsers/applyRoutePrefs.ts`
- Mock 工具实现（搜索/ETA/订位/下单/发送等）：
  - `src/lib/tools/mockTools.ts`
- 执行器（按工具逐步执行，产出 trace；包含 check/plan/execute/share 阶段、失败与 fallback 决策记录）：
  - `src/lib/executor/executePlan.ts`
- 执行面板（不展示详细 trace，只展示凭证结果 + 可复制转发文案）：
  - `src/components/ExecutionPanel.tsx`
- 规划器升级为 slot planner（主方案 + 备选方案 + 选型理由 + 风险 + 与主方案差异对比）：
  - `src/lib/planRoute.ts`
  - `src/components/RouteTimeline.tsx`
- 地图（合规底图）：OpenStreetMap + Leaflet，支持显示规划折线、POI 点击选中
  - `src/components/LeafletPlannerMap.tsx`
  - mock POI 坐标：`src/lib/mockPois.ts`
- POI 点击详情 + 反馈闭环（“我不喜欢”→避开点位重新规划）：
  - `src/components/PoiDetailPanel.tsx`
  - 避开策略注入：`src/lib/runAgent.ts`（按 excludedPoiIds 过滤）

### 仍建议补齐/增强的能力（按优先级）

1. 设计文档（≤2页）
   - Planning 策略：Parse → Clarify → Candidate → Check → Assemble → Execute
   - 工具调用链路与异常处理：订位失败/排队过长/通勤超限的回退策略
2. 扩充 Mock 数据（让意图变化的效果更明显）
   - 增加更多餐厅/活动 POI（火锅/烧烤/日料/轻食/亲子/展览/雨天室内/夜宵等），并拉开排队/订位/预算差异
3. 完善补全问题（仍保持弹窗问答，最多 3-4 问/轮）
   - 是否有小朋友/年龄、饮食偏好（辣/清淡/减脂/素食）、预算确认、是否必须订位、可接受排队时长
4. 强化失败回退策略
   - 将“触发备选”的规则从 demo 级阈值提升为更完整的策略（通勤超限/活动无票/超预算/不适合人群等）
5. 体验打磨
   - 规划与执行的“摘要提示”更明确（比如顶部给一句话总结 + 风险提示 + 备选触发条件）
