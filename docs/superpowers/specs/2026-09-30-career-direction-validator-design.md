# 职业方向验证器 V1 设计

日期：2026-09-30
状态：待产品确认
适用项目：Jianvia / `bazi-mvp`

## 1. 背景与目标

现有职业专项报告已经能够生成 3–5 个候选职业，并为每个职业提供工作现实、能力信号、现实门槛和最低成本验证计划。当前缺口是：这些内容仍停留在“建议用户怎么验证”，用户无法在产品内真正完成一次任务、提交证据、复盘过程并得到下一轮判断。

V1 新增独立的“职业方向验证器”，把单个候选职业推进为一个可恢复、可提交、可评价的职业实验：

> 候选职业 → 明确关键未知 → 冻结真实岗位快照 → 冻结最低成本实验 → 用户提交工作样本 → 轻量复盘 → 基于证据更新判断 → 一个下一步行动

本模块不证明用户“适合”或“不适合”某个职业，只减少一个具体不确定性。

### 成功标准

1. 用户从职业卡进入后，立即知道本轮只验证哪一个关键问题。
2. 用户可以在 1–3 小时内完成接近真实职业核心工作的任务。
3. 刷新、关闭浏览器后再次打开，已生成任务、草稿、复盘和结果均不改变、不丢失。
4. AI 评价只引用本轮提交、复盘、冻结的现实约束与服务端认可的岗位来源。
5. 结果只使用“值得继续验证 / 证据不足 / 当前不建议增加投入”。
6. 结果页只给一个最低成本下一步。

## 2. 已确认的方案与边界

采用独立验证器页面方案，而不是把长任务嵌入职业报告。

### V1 包含

- 每个已具备 `workValidation` 的职业卡增加“低成本验证这个方向”。
- 独立验证器路由与渐进式流程。
- 岗位真相、关键未知、微型工作样本、Markdown 提交、可选公开成果链接、4 个轻量复盘问题、结构化 AI 评价、三态结果、唯一下一步。
- 独立本地持久化与服务端持久化。
- 每个职业实验独立、最小权限的 capability。
- 服务端签名、幂等生成、来源快照和实验版本冻结。
- 现有 analytics no-op 接口扩展事件名称。

### V1 不包含

- 文件附件上传、对象存储、文件解析、病毒扫描或文件权限。
- 登录、账号中心、跨账号或跨设备同步承诺。
- 社区、导师、课程、简历、积分或企业 HR 功能。
- 自动访问、抓取或解析用户填写的公开成果链接。
- 重做基础报告、现实校准、支付核心、职业专项报告或视觉品牌。

数据结构可预留 `attachments`，但 V1 必须始终为空数组，UI 不展示上传入口。

## 3. 现有能力复用

| 现有能力 | V1 用法 |
|---|---|
| `CareerReport.careerHypotheses` | 职业入口和候选职业身份 |
| `CareerWorkValidation` | 只作为“验证计划/前置依据”，不保存实验运行数据 |
| `MarketEvidence` | 构建冻结的 `sourceSnapshot` |
| Gemini structured output + Zod | 生成实验与分析结果 |
| Google Search grounding | 不在实验阶段重复泛搜；复用报告阶段已经校验的岗位证据 |
| Supabase service-role adapter | 保存验证会话的服务端副本 |
| `trackCareerEvent` | 扩展最少必要生命周期事件，继续保持无敏感数据 |
| 当前 CSS 设计系统 | 新页面沿用现有颜色、圆角、按钮和移动端间距 |

`workValidation` 的责任到此为止：提供职业工作现实、能力信号、门槛、来源和建议验证路径。实际实验、提交、反思、证据和结果只能进入 `CareerValidationSession`。

## 4. 总体架构

### 4.1 页面与入口

- 报告页：在有 `workValidation` 且有对应 capability 的职业卡上显示 CTA。
- 新页面：`/career-validation/[validationSessionId]`。
- 新页面不依赖报告页保持打开；加载时先读独立本地存储，再通过 capability 向服务端恢复和校验。
- 旧报告、缺少 capability 的报告、只读历史报告不显示可执行 CTA，不伪造可用状态。

### 4.2 API

新增四个窄接口：

1. `POST /api/career-validation/session`
   - 使用该职业预签发的 capability 创建或恢复指定 `validationSessionId`。
   - 首次创建时冻结 `sourceSnapshot` 和上游职业依据。
   - 幂等：重复调用返回同一会话。

2. `POST /api/career-validation/experiment`
   - 只在会话尚无实验时生成。
   - 成功后保存冻结的实验 JSON、`experimentVersion` 和内容摘要。
   - 重复请求返回已保存实验，绝不重新生成。

3. `PATCH /api/career-validation/session`
   - 保存 Markdown 草稿、公开链接、反思答案和步骤状态。
   - 严格限制可变字段，不能覆盖来源快照、实验或已完成结果。

4. `POST /api/career-validation/analyze`
   - 验证提交和反思完整后，基于冻结实验与 Rubric 生成结构化结果。
   - 幂等：结果存在时直接返回。
   - 同时预签发下一轮实验的子会话 capability；只有用户点击唯一下一步时才初始化子会话。

读取接口采用 POST body 携带 capability，避免把能力令牌放入 URL、日志或 Referer。

## 5. 最小权限 Capability

### 5.1 签发时机

付费职业报告完成后，服务端为每个可验证职业预生成：

- `reportId`
- `careerId`
- `validationSessionId`
- 对应 capability

这些信息通过 SSE 报告事件的独立 `validationAccess` 字段返回，不写进报告正文，也不改变支付凭证。

### 5.2 载荷

```ts
type CareerValidationCapability = {
  version: 1;
  scope: 'career_validation';
  reportId: string;
  careerId: string;
  validationSessionId: string;
  issuedAt: number;
  expiresAt: number;
};
```

使用 HMAC 签名，并在每个验证器 API 中同时核对四个绑定字段、固定 scope 和有效期。V1 有效期固定为 30 天，足够完成多轮低成本验证，又不会变成永久权限。

Capability 只能读取/写入该 `validationSessionId`，不能读取完整付费报告、其他职业、其他验证会话或支付信息。它不是原支付 receipt 的延长，也不能重新生成付费报告。

下一轮实验使用新的 `validationSessionId` 和新的 capability，旧 capability 不能创建任意子会话。

### 5.3 过期处理

- 本地草稿仍可只读展示和复制。
- 禁止继续调用付费 AI 接口。
- UI 明确提示“验证权限已过期，已填写内容仍保存在本机”。
- V1 不提供自动续期，避免扩大授权边界。

## 6. 独立持久化策略

验证器不使用现有 `sessionStorage` 作为恢复承诺。

### 6.1 浏览器本地副本

- 使用独立 `localStorage` key：`jianvia.career-validator.v1`。
- 按 `validationSessionId` 保存会话、capability、当前步骤和最近服务端版本。
- 每次文本、链接和反思变更进行防抖保存；步骤切换和提交前立即保存。
- 本地存储仅用于同一浏览器恢复，不承诺跨设备同步。

### 6.2 服务端权威副本

新增 Supabase 表 `career_validation_sessions`，字段如下：

```text
id uuid primary key
report_id text not null
career_id text not null
parent_validation_session_id uuid null
status text not null
source_snapshot jsonb not null
source_snapshot_version integer not null
experiment jsonb null
experiment_version integer null
submission jsonb null
reflection jsonb null
result jsonb null
revision integer not null default 1
capability_expires_at timestamptz not null
created_at timestamptz not null
updated_at timestamptz not null
```

RLS 开启，`anon` 和 `authenticated` 无直接权限，只允许服务端 service role 访问。API 先验证 capability，再操作唯一绑定行。

### 6.3 冲突策略

- 不做复杂协同编辑。
- `revision` 用于乐观并发控制。
- 服务端版本较新时，恢复服务端副本；本地存在未同步草稿时保留本地草稿并提示重新保存，不能静默覆盖。
- 完成后的 `sourceSnapshot`、`experiment` 和 `result` 均不可修改。

## 7. 正式数据模型

### 7.1 来源快照

```ts
SourceSnapshot {
  version: 1
  frozenAt: datetime
  marketStatus: 'verified' | 'partial' | 'unavailable'
  locationLabel: string // 无明确城市时固定“全国样本”
  sources: Array<{
    sourceType
    sourceName
    sourceUrl?
    retrievedAt
    fact
  }>
  limitationNote: string
}
```

来源只允许从服务端已校验的 `workValidation.workReality.evidence` 和职业候选来源中提取。客户端传来的新 URL 不能进入该快照。

### 7.2 实验

```ts
CareerExperiment {
  id: string
  version: 1
  executionMode: 'online_work_sample' | 'offline_low_risk_experience'
  validationQuestion: string
  uncertaintyType:
    | 'work_content'
    | 'task_ability'
    | 'learning_response'
    | 'real_world_feasibility'
    | 'work_experience_feeling'
  hypothesis: string
  title: string
  scenario: string
  role: string
  objective: string
  providedInformation: string[]
  prerequisites: string[]
  estimatedMinutes: number // 60–180；线下模式允许 20–180
  steps: string[]
  deliverable: string
  rubric: Array<{ criterion: string; basicStandard: string }>
  referenceStructure: string[]
  reflectionPrompts: string[] // 固定映射为3–5个轻量题
  limitationNote?: string
  generatedAt: datetime
}
```

实验生成成功后立即持久化并冻结。同一个 `validationSessionId` 无论刷新、重试还是恢复，都只能返回该版本。

### 7.3 提交与反思

```ts
Submission {
  format: 'markdown'
  content: string // 20–30000字符
  publicResultUrl?: string // 仅HTTPS
  attachments: [] // V1固定为空，预留未来扩展
  completedAt?: datetime
}

Reflection {
  engagement: 'time_flew' | 'neutral' | 'draining'
  persistence: 'naturally_continued' | 'forced_continue' | 'wanted_to_stop'
  repeatWillingness: 'willing' | 'uncertain' | 'unwilling'
  difficulty: 'too_easy' | 'manageable' | 'too_hard'
  notes?: string
}
```

公开成果链接只保存、显示和导出。服务端不会 fetch，链接不会进入 AI 分析提示词。UI 固定展示：

> AI 没有访问或读取此链接内容；本次评价仅基于你粘贴的文字与复盘答案。

### 7.4 证据与结果

```ts
EvidenceItem {
  dimension:
    | 'task_performance'
    | 'work_experience_feeling'
    | 'learning_response'
    | 'real_world_feasibility'
    | 'external_feedback'
  signal: 'support' | 'mixed' | 'no_evidence' | 'risk'
  observation: string
  interpretation: string
  limitation: string
}

ValidationResult {
  status:
    | 'worth_continuing'
    | 'insufficient_evidence'
    | 'do_not_increase_investment'
  validatedQuestion: string
  evidence: EvidenceItem[]
  supportingEvidence: string[]
  riskSignals: string[]
  unknowns: string[]
  reasoning: string
  nextAction: {
    title: string
    detail: string
    estimatedMinutes: number
    cost: string
  }
  analyzedAt: datetime
}
```

`external_feedback` 在 V1 第一轮默认为 `no_evidence`。公开链接本身不构成外部反馈。

## 8. 状态机与用户流程

```text
created
  → generating_experiment
  → ready
  → in_progress
  → submitted
  → analyzing
  → completed
```

可恢复错误状态：

- `experiment_generation_failed`：保留来源快照，允许重试；如 AI 持续失败，使用安全 fallback 实验。
- `analysis_failed`：保留提交和反思，允许重试，不要求重新做任务。
- `persistence_degraded`：本地副本仍可编辑，并明确服务器同步失败。
- `capability_expired`：本地只读、可复制，不能继续调用 AI。

页面分为五个渐进步骤，而不是复杂 Dashboard：

1. **验证目标**：职业名称、本轮最大不确定性、为什么优先验证它。
2. **岗位真相**：3–5 个代表性证据（不足时如实显示）、重复工作、门槛、来源和 AI 综合判断的视觉区分。
3. **真实工作样本**：场景、角色、任务、步骤、交付物、Rubric、预计时间；用户点击开始后记录状态。
4. **提交与复盘**：Markdown 文本、可选公开链接、四个轻量问题。
5. **验证结果**：3–5 条关键证据、三态判断、唯一下一步。

点击唯一下一步时，使用服务端预签发的子 capability 初始化下一轮会话。下一轮是新 `validationSessionId`，上一轮保持不可变并可回看。

## 9. AI 调用设计

### 9.1 实验生成

输入只包含：

- 已选职业及现有候选理由；
- 冻结的 `sourceSnapshot`；
- `workValidation` 中的工作现实、能力信号和门槛；
- 已确认的粗粒度现实约束与职业资本；
- 如为下一轮，上一轮结果中的未知项和唯一下一步。

输出严格使用 `CareerExperimentSchema`。提示词必须约束：不重新推荐职业、不做性格测试、选择信息价值最高且可低成本验证的问题、1–3小时、明确交付物、中国场景、监管或线下职业不能伪造线上任务。

### 9.2 结果分析

输入只包含：

- 冻结实验与 Rubric；
- 用户粘贴的 Markdown 内容；
- 结构化反思；
- 冻结的现实门槛；
- 上一轮尚未验证项（如有）。

明确排除 `publicResultUrl` 和附件字段。输出严格使用 `ValidationResultSchema`，并遵循：

> 观察事实 → 解释 → 不确定性 → 一个最低成本下一步

AI 不得输出百分比、人格结论、“验证通过”或“你不适合”。服务端再次校验状态枚举、证据维度完整性和唯一下一步。

### 9.3 Fallback

- 实验生成失败：根据 `workValidation.validationPath[0]` 和工作现实生成一份确定性 fallback；若职业需要线下实践，则生成低风险线下体验而不是虚假线上任务。
- 结果分析失败：不生成结论，状态保留 `analysis_failed`，用户输入不丢失。
- 字段缺失或非法 JSON：Zod 拒绝并进入上述降级，不把原始 JSON 显示给用户。

## 10. 真实岗位证据与视觉边界

岗位真相页分成两个明确区域：

1. **真实岗位证据**：来源名称、事实、检索时间、可访问来源链接。
2. **AI 综合分析**：从多个来源归纳的重复任务、能力信号和门槛。

若少于 3 个代表性真实职位来源，页面不补齐数量，显示实际数量和：

> 当前未获取到足够实时岗位样本，以下实验基于已验证来源与通用职业信息设计。

若完全无来源，则所有市场事实区域进入 unavailable 状态，实验仍可围绕职业核心工作做低成本探索，但不能声称来自实时招聘市场。

强监管职业在任务前优先显示资质门槛。资质没有逐条官方来源绑定时，只能显示“待官方核实”。

## 11. UI/UX

- 沿用现有晨光主题和按钮层级，不新增品牌视觉。
- 375 / 390 / 430 px 均为单列，不使用表格。
- 顶部为简短步骤指示，不占用过多高度。
- 长说明默认折叠；当前任务、交付物和 CTA 始终优先。
- 编辑页底部使用安全区兼容的 sticky CTA，但不得遮挡 textarea 内容。
- 所有按钮和 disclosure 最小点击高度 44 px。
- textarea 支持长文本、自适应宽度和字数提示；Markdown 作为纯文本提交，不在 V1 引入渲染依赖。
- loading、empty、partial、error、saved、resumed、completed、expired 均有明确文案和恢复路径。
- 页面关闭或路由离开时，如果存在未同步草稿，显示浏览器原生离开提醒；同步完成后不打扰。

## 12. Analytics

扩展现有无副作用的 `trackCareerEvent`：

- `career_validation_started`
- `job_reality_viewed`
- `experiment_started`
- `experiment_completed`
- `reflection_completed`
- `validation_result_viewed`
- `next_experiment_clicked`
- `career_validation_abandoned`

只允许：`careerId` 的不可逆短标识、步骤、耗时、恢复状态、实验层级等粗粒度字段。禁止发送提交正文、链接、反思内容、出生信息、收入或城市。

## 13. 安全与隐私

- 所有服务端接口验证 capability、请求 Schema 和会话绑定。
- 公开链接仅允许 HTTPS；不 fetch、不预览、不传给模型。
- 用户 Markdown 按纯文本处理，不直接使用 `dangerouslySetInnerHTML`。
- 模型输入中的用户文本采用惰性 JSON 包装，明确视为数据，抵御提示注入。
- 来源 URL 只能来自既有服务端 Search allowlist；模型 URL 不进入 `sourceSnapshot`。
- API 限制提交长度、反思长度、实验次数和模型调用幂等键，防止意外重复成本。
- Supabase 表不向客户端开放，capability 不写 URL。

## 14. 兼容与迁移

- `CareerReportSchema` 本身保持向后兼容；`workValidation` 继续可选。
- 报告 SSE 事件新增可选 `validationAccess`，旧客户端忽略即可。
- `DeepFlowState` 新增可选访问映射时提升 session 版本并提供 V3 → V4 迁移；不删除旧报告。
- 验证器使用独立 localStorage envelope 和版本，不与深度报告 session 混合。
- Supabase 新表使用独立 SQL migration，不改现有 `deep_report_sessions` 和支付表。
- 用户未提交的 `lib/gemini/prompt.ts` 不在本功能范围内，实施时不得修改、暂存或格式化。

## 15. 测试策略

### Schema 与安全

- capability 四字段、scope、签名和过期校验。
- 来源快照只接受服务端认可来源。
- 实验与结果结构化输出、非法 JSON 降级。
- 公开链接不进入 AI prompt，服务端不发生 fetch。
- Markdown 不以 HTML 注入方式渲染。

### API 与幂等

- 创建/恢复同一会话得到相同来源快照。
- 同一会话只生成一个实验版本。
- 重复分析不重复调用模型。
- 单次生成或分析失败不丢失已有状态。
- capability 不能访问其他 report、career 或 validation session。

### 前端流程

- 从候选职业卡进入验证器。
- 显示来源不足、监管门槛和线下职业状态。
- 可开始实验、保存 Markdown、填写公开链接、完成四项反思、提交分析、查看三态结果。
- 喜欢但表现弱、表现强但体验差时呈现混合证据。
- 下一步只有一个，点击后进入新的子会话。
- localStorage 与服务端恢复、版本冲突、过期只读。

### 响应式与可访问性

- 375 / 390 / 430 px 无横向溢出。
- sticky CTA 不遮挡内容。
- 输入框、步骤条、长文本、错误、modal、折叠组件可键盘操作，点击区域不小于 44 px。

最终执行完整 tests、`tsc --noEmit`、lint 和生产 build。已知基础提示词旧断言与用户未提交 V4 prompt 的不一致，应独立记录，不允许通过覆盖 `prompt.ts` 解决。

## 16. 风险与限制

1. **无账号体系**：V1 只能承诺同一浏览器恢复；即使服务器保存了副本，也不能安全地让另一设备发现该会话。
2. **Capability 到期**：到期后保留本地只读数据，但不能继续消耗 AI；V1 不自动续期。
3. **岗位来源数量**：Search 可能不足 3 条，产品必须接受不完整状态，不能补造。
4. **AI 评价不是专业认证**：Rubric 评价只针对一次任务，不代表真实招聘结果。
5. **公开成果链接未读取**：链接仅作为用户记录；如果正文没有粘贴对应内容，AI 无法评价链接中的成果。
6. **Supabase migration**：上线前必须先应用新表 SQL，否则客户端仍可依靠 localStorage 工作，但服务器同步和 AI 会话恢复不可用。

## 17. 验收清单

- [ ] 每个具备前置验证依据的职业卡都有独立 CTA。
- [ ] 用户能看到一个明确的本轮关键未知。
- [ ] 实验接近真实工作、1–3小时、有明确交付物与 Rubric。
- [ ] 任务生成后刷新不改变。
- [ ] Markdown、公开链接和反思可以恢复。
- [ ] UI 明确说明公开链接未被 AI 读取。
- [ ] AI 结果包含支持、风险、未知与三态判断。
- [ ] 结果只给一个下一步。
- [ ] 下一轮使用独立子会话与 capability。
- [ ] 无实时来源时明确降级。
- [ ] 监管或线下职业不生成虚假线上实验。
- [ ] 375 / 390 / 430 px 可用。
- [ ] 不修改基础报告 prompt、支付核心和既有品牌视觉。
