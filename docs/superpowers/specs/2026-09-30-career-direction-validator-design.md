# 职业方向验证器 V1 设计

日期：2026-09-30
状态：待产品确认（架构修订版）
适用项目：Jianvia / `bazi-mvp`

## 1. 背景、目标与成功标准

现有职业专项报告能生成候选职业及其 `workValidation`，但用户还不能在产品内真正完成任务、提交证据、复盘并获得下一步判断。V1 新增独立“职业方向验证器”，形成闭环：

> 候选职业 → 冻结验证上下文 → 明确关键未知 → 冻结最低成本实验 → Markdown 提交 → 固定四项复盘 → 证据评价 → 一个站内或现实世界的下一步

本模块不证明用户“适合”或“不适合”某职业，只减少一个具体不确定性。产品终点不是让用户无限进行 AI 模拟题，而是逐步把用户送向真实工作和真实市场。

成功标准：

1. 用户进入后立即知道本轮只验证哪一个问题。
2. 用户可在 1–3 小时内完成接近真实工作的任务；无法安全模拟时使用岗位真相验证或职业核心工作认知实验。
3. 同一浏览器恢复后，冻结上下文、实验、草稿、复盘和结果不漂移、不丢失。
4. AI 只读取当前会话的可信冻结输入，不读取历史聊天、其他职业或客户端自由构造的数据。
5. 结果保持“值得继续验证 / 证据不足 / 当前不建议增加投入”三态，能力表现与工作体验分别呈现。
6. 结果只有一个 nextAction；只有明确的站内实验下一步才能创建子会话。
7. 用户可删除单次验证数据，不影响原报告或支付记录。

## 2. 范围与边界

采用独立 `/career-validation/[validationSessionId]` 页面，不把长任务嵌入职业报告。

### V1 包含

- 职业卡 CTA、独立验证器、完整冻结上下文、关键未知和微型工作样本。
- Markdown 提交、可选公开成果链接、固定四项复盘、结构化 AI 评价、三态结果和唯一下一步。
- 独立 `localStorage + Supabase` 持久化、乐观并发、内容冻结、版本追踪和数据删除。
- 最小权限 capability、服务端签名、幂等操作、可信输入边界和两层 fallback。

### V1 不包含

- 文件附件上传、对象存储、文件解析、病毒扫描或复杂文件权限。
- 登录、账号中心、跨账号或跨设备同步承诺。
- 自动访问、抓取、预览或解析用户填写的公开成果链接。
- 外部现实行动完成后的站内反馈闭环。
- 社区、导师、课程、简历、积分或企业 HR 功能。
- 重做基础报告、现实校准、支付核心、职业专项报告或视觉品牌。

数据结构保留 `attachments`，但 V1 始终为空数组，UI 不展示上传入口。

## 3. 复用与责任边界

| 现有能力 | V1 用法 |
|---|---|
| `CareerReport.careerHypotheses` | 初始职业入口和职业身份 |
| `CareerWorkValidation` | 只作为验证计划/前置依据，创建会话时复制进冻结上下文 |
| `MarketEvidence` | 构建冻结上下文中的 `marketEvidence` |
| Gemini structured output + Zod | 生成实验与分析结果 |
| Google Search grounding | 只复用报告阶段已由服务端认可的来源，不在实验阶段重复泛搜 |
| Supabase service-role adapter | 保存服务端权威副本 |
| `trackCareerEvent` | 扩展生命周期事件，不发送敏感内容 |
| 当前 CSS 设计系统 | 沿用现有视觉与移动端间距 |

`workValidation` 的责任到“验证计划/前置依据”为止。实际实验、提交、反思、证据、评价和结果只进入 `CareerValidationSession`，不得反写职业报告或基础报告。

## 4. 完整产品闭环

```text
职业专项报告候选职业
  → 点击“低成本验证这个方向”
  → 服务端校验 capability
  → 创建并冻结 ValidationContextSnapshot
  → 确定一个关键未知
  → 生成并冻结一个最低成本职业实验
  → 用户完成任务
  → Markdown + 固定四项 Reflection
  → AI 按冻结 Rubric 分析
  → Support / Mixed / No Evidence / Risk
  → 值得继续验证 / 证据不足 / 当前不建议增加投入
  → 一个 NextAction
      ├─ 现实行动：只展示行动说明
      └─ in_product_experiment：用户主动点击后创建唯一子会话
```

每轮都是独立 `CareerValidationSession`。父会话完成后不可变，子会话不能修改父会话，也不能读取兄弟会话或其他职业数据。

## 5. 总体架构

- 报告页仅在职业具备 `workValidation` 且服务端提供对应初始 capability 时显示 CTA。
- URL 只含不可猜测的 `validationSessionId`，不含 capability。
- 页面先读取独立本地副本，再用 capability 创建或恢复服务端权威副本。
- 旧报告、缺少 capability 的报告和只读历史报告不伪造可执行状态。

服务边界：

1. **Capability 服务**：签发、验证、过期和绑定。
2. **Session 服务**：创建、恢复、更新、删除、状态迁移和并发控制。
3. **Snapshot 构建器**：从服务端确认的数据构建不可变上下文。
4. **Experiment 服务**：从冻结上下文生成并冻结实验，负责 fallback。
5. **Evaluation 服务**：从当前会话可信输入生成并冻结结果。
6. **Persistence adapter**：封装 Supabase 条件更新和幂等。
7. **Local envelope**：同一浏览器恢复和未同步草稿保护。

客户端不得提交完整 `workValidation`、市场来源、实验或评价结果。

## 6. 最小权限 Capability

付费职业报告完成后，服务端为每个可验证职业预生成 `reportId`、`careerId`、`validationSessionId` 和 capability，通过 SSE 独立 `validationAccess` 字段返回，不写进报告正文，也不改变支付凭证。

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

- 使用 HMAC 签名；每个 API 同时核对签名、scope、四个绑定字段、数据库绑定、删除状态和有效期。
- TTL 来自服务端 `CAREER_VALIDATION_CAPABILITY_TTL_SECONDS`，默认 2,592,000 秒（30 天），Schema 不依赖固定天数。
- capability 只能访问绑定会话，不能读取完整付费报告、其他职业、父/子/兄弟会话或支付信息。
- token 只在请求 body 或受控请求头中传输，不进入 URL、日志、analytics 或 Referer。
- Supabase 不存原始 token，只存签发/过期时间和绑定字段；服务端可从规范化载荷重建签名。
- 过期后本地内容可只读、复制或删除，但不能调用保存、生成、分析、下一轮或服务端删除 API；V1 不自动续期。

## 7. ValidationContextSnapshot

创建会话时一次性冻结完整上下文。同一轮从创建到完成只读这份快照，不重新读取变化后的职业报告。

```ts
type ValidationContextSnapshot = {
  version: 1;
  contextHash: string;
  sourceReport: {
    reportId: string;
    reportVersion?: number;
    reportHash?: string;
  };
  career: {
    careerId: string;
    careerName: string;
    candidateReason: string;
  };
  workValidation: CareerWorkValidation;
  relevantConstraints: {
    location?: string;
    incomeBoundary?: string;
    timeCapacity?: string;
    educationTolerance?: string;
    mobility?: string;
    otherBarriers?: string[];
  };
  relevantCareerCapital: {
    experience: string[];
    skills: string[];
    evidence: string[];
  };
  marketEvidence: {
    marketStatus: 'verified' | 'partial' | 'unavailable';
    locationLabel: string;
    sources: Array<{
      sourceType: string;
      sourceName: string;
      sourceUrl?: string;
      retrievedAt: string;
      fact: string;
    }>;
    limitationNote: string;
  };
  parentResultSummary?: {
    parentValidationSessionId: string;
    validatedQuestion: string;
    status:
      | 'worth_continuing'
      | 'insufficient_evidence'
      | 'do_not_increase_investment';
    evidenceSummary: string[];
    unknowns: string[];
    requestedNextActionType: 'in_product_experiment';
  };
  frozenAt: string;
};
```

规则：

- 初始快照只从绑定 `reportId + careerId` 的服务端报告读取，客户端不能提交职业依据或市场来源。
- Zod 解析并 strip 未声明字段；`contextHash` 对规范化 JSON 计算，用于漂移检测。
- 市场来源只接受服务端 Search allowlist 已认可来源；模型 URL 和用户公开链接不得进入。
- 创建后数据库禁止更新 `validation_context_snapshot`；相关 patch 直接拒绝。
- 子会话不读取“当前最新报告”，只复制父快照中的基础职业上下文并加入服务端生成的最小父结果摘要，再生成自己的新快照和 hash。
- 父结果摘要不含用户完整 Markdown。

## 8. 数据模型

### 8.1 CareerExperiment

```ts
type CareerExperiment = {
  id: string;
  version: 1;
  executionMode:
    | 'online_work_sample'
    | 'offline_low_risk_experience'
    | 'job_reality_review'
    | 'core_work_awareness';
  validationQuestion: string;
  uncertaintyType:
    | 'work_content'
    | 'task_ability'
    | 'learning_response'
    | 'real_world_feasibility'
    | 'work_experience_feeling';
  hypothesis: string;
  title: string;
  scenario: string;
  role: string;
  objective: string;
  providedInformation: string[];
  prerequisites: string[];
  estimatedMinutes: number;
  steps: string[];
  deliverable: string;
  rubric: Array<{ criterion: string; basicStandard: string }>;
  referenceStructure: string[];
  limitationNote?: string;
  generatedAt: string;
  generationMetadata: {
    experimentGeneratorVersion: string;
    experimentPromptVersion: string;
    rubricVersion: string;
    experimentModelId: string;
  };
};
```

正常实验预计 60–180 分钟，低风险线下体验允许 20–180 分钟。Schema 不含 `reflectionPrompts`；AI 无权改变复盘问题。实验生成后立即持久化并冻结，同一会话刷新、重试或恢复只返回原版本。

### 8.2 Submission

```ts
type Submission = {
  format: 'markdown';
  content: string; // 20–30000字符
  publicResultUrl?: string; // 只允许HTTPS
  attachments: []; // V1固定为空
  completedAt?: string;
};
```

公开链接只保存、显示和导出。服务端不 fetch、不解析、不预览，链接及页面内容不进入 AI prompt。UI 固定展示：

> AI 没有访问或读取此链接内容；本次评价仅基于你粘贴的文字与复盘答案。

Markdown 输入区固定展示：

> 请勿粘贴公司机密、客户隐私、未公开业务数据或其他敏感信息。

### 8.3 Reflection

```ts
type Reflection = {
  engagement: 'time_flew' | 'neutral' | 'draining';
  persistence:
    | 'naturally_continued'
    | 'forced_continue'
    | 'wanted_to_stop';
  repeatWillingness: 'willing' | 'uncertain' | 'unwilling';
  difficulty: 'too_easy' | 'manageable' | 'too_hard';
  notes?: string;
};
```

四个主字段由产品和前端固定，方便跨职业、跨轮次比较；AI 不生成问题，也不改变枚举。

### 8.4 EvidenceItem

```ts
type EvidenceItem = {
  dimension:
    | 'task_performance'
    | 'work_experience_feeling'
    | 'learning_response'
    | 'real_world_feasibility'
    | 'external_feedback';
  signal: 'support' | 'mixed' | 'no_evidence' | 'risk';
  observation: string;
  interpretation: string;
  limitation: string;
};
```

`external_feedback` 在第一轮默认为 `no_evidence`，公开链接不构成外部反馈。必须允许“表现好但不愿长期做”和“喜欢但当前能力不足”。不得合并成匹配度、百分比、总分或等级。

### 8.5 ValidationNextAction 与 ValidationResult

```ts
type ValidationNextAction = {
  type:
    | 'in_product_experiment'
    | 'external_validation'
    | 'market_contact'
    | 'bridge_path'
    | 'credential_check'
    | 'real_project'
    | 'pause';
  title: string;
  detail: string;
  estimatedMinutes?: number;
  estimatedTimeLabel?: string;
  cost: string;
  canStartInProduct: boolean;
};

type ValidationResult = {
  status:
    | 'worth_continuing'
    | 'insufficient_evidence'
    | 'do_not_increase_investment';
  validatedQuestion: string;
  evidence: EvidenceItem[];
  supportingEvidence: string[];
  riskSignals: string[];
  unknowns: string[];
  reasoning: string;
  nextAction: ValidationNextAction;
  analyzedAt: string;
  generationMetadata: {
    evaluationPromptVersion: string;
    rubricVersion: string;
    evaluationModelId: string;
  };
};
```

只允许一个 nextAction。服务端交叉校验：仅 `type === 'in_product_experiment'` 时 `canStartInProduct` 可以为 `true`；其他类型必须为 `false`。禁止“验证通过”“你不适合”、百分比或排名。

### 8.6 会话级生成元数据

```ts
type ValidationGenerationMetadata = {
  experimentGeneratorVersion?: string;
  experimentPromptVersion?: string;
  evaluationPromptVersion?: string;
  rubricVersion?: string;
  experimentModelId?: string;
  evaluationModelId?: string;
};
```

元数据由服务端持久化，不向普通用户展示。只保存版本号和模型标识，不保存系统 Prompt 正文。

## 9. API

所有接口都验证 capability、Schema、数据库绑定、状态、过期和删除状态。

### `POST /api/career-validation/session`

- 输入初始 capability，不接受客户端职业上下文。
- 首次创建时构建并冻结完整快照。
- 相同会话重复请求返回原会话，不重建快照。
- 已删除会话返回 `410 SESSION_GONE`，旧 capability 不能重建。

### `POST /api/career-validation/experiment`

- 只读取冻结快照及其中的父结果摘要。
- 只在尚无实验时生成，保存版本和 generation metadata。
- 调用模型前，服务端以条件更新把状态原子地从 `created`/可重试失败态改为 `generating_experiment`，并写入短期 operation lease；只有取得 lease 的请求可以调用模型。
- 同期请求返回 `202 OPERATION_IN_PROGRESS`，实验存在后返回已冻结实验。结果写回必须匹配 operation token；旧请求或已删除会话的迟到结果不能落库。
- 失败执行第 13 节 fallback，不重建快照。

### `PATCH /api/career-validation/session`

```ts
{
  expectedRevision: number;
  patch: {
    submission?: Submission;
    reflection?: Reflection;
    status?: 'in_progress' | 'submitted';
  };
}
```

数据库条件为 `id = validationSessionId AND revision = expectedRevision AND deleted_at IS NULL`。成功后 revision 加一并返回；不一致返回 `409 VERSION_CONFLICT` 和最新服务端 revision。patch 不能修改绑定、快照、实验、结果或元数据。

### `POST /api/career-validation/analyze`

- 仅在提交和固定 Reflection 完整、会话未删除且尚无结果时执行。
- 只读取可信评价输入。
- 调用模型前，服务端以条件更新把状态原子地从 `submitted`/可重试失败态改为 `analyzing` 并取得 operation lease；只有 lease 持有者调用模型。
- 同期请求返回 `202 OPERATION_IN_PROGRESS`；结果写回必须匹配 operation token。结果存在后重复请求返回同一冻结结果。
- 不预签、不创建下一轮 capability 或子会话。

### `POST /api/career-validation/next`

- 仅允许已完成父会话调用。
- 必须同时满足 `nextAction.type === 'in_product_experiment'` 与 `canStartInProduct === true`。
- 事务内创建唯一子 ID、绑定父 ID、生成子快照并签发新 capability。
- `parent_validation_session_id` 唯一约束保证重复点击只返回同一子会话。
- 重复点击使用子会话已保存的 issued/expires 时间重建同一规范化 capability，不重新延长 TTL。
- 其他类型返回 `409 NEXT_ACTION_NOT_IN_PRODUCT`，不创建记录。

### `DELETE /api/career-validation/session`

- 再次校验当前、未过期、绑定一致的 capability。
- 采用“内容不可逆清除 + 最小 tombstone”：状态改为 `deleted`，写入 `deleted_at`，清空快照、实验、提交、反思、结果和元数据，仅保留阻止重放所需的 ID、绑定和审计时间。
- 每个会话独立删除，不级联父/子会话，不删除原报告或支付记录。
- 客户端成功后清除对应 localStorage；旧 capability 不能恢复或继续调用。

## 10. 状态机

```text
created
  → generating_experiment
  → ready
  → in_progress
  → submitted
  → analyzing
  → completed

任一未删除状态 → deleted（终止）
```

可恢复状态：`experiment_generation_failed`、`analysis_failed`、`persistence_degraded`、`capability_expired`。`completed` 的快照、实验和结果不可修改。`deleted` 对生成、PATCH、分析和下一轮统一返回 `410 SESSION_GONE`。operation lease 到期后允许新请求取得新 token 重试；旧 token 的迟到结果必须被拒绝。

## 11. 持久化与乐观并发

### 本地副本

- 独立 key：`jianvia.career-validator.v1`。
- 按会话保存页面投影、capability、步骤、最新 revision、未同步草稿和 `retentionExpiresAt`。
- 文本/链接/反思防抖保存，步骤切换、提交和离开前立即保存。
- 只承诺同一浏览器恢复，不承诺跨设备同步。
- retention 到期或主动删除时清理相应本地记录。

### 冲突协议

1. PATCH 始终带 `expectedRevision`。
2. 条件更新失败返回 `409 VERSION_CONFLICT`。
3. 前端保留当前本地草稿，获取服务端最新投影并提示另一页面已有更新。
4. 文本不自动合并；用户明确选择后以最新 revision 重交。
5. 禁止服务器静默覆盖本地未同步内容，也禁止客户端静默覆盖较新服务端内容。
6. 冻结快照、实验和结果不参与合并。

两个标签页同时编辑是必须覆盖的正常冲突场景。

## 12. AI 可信输入

实验生成 AI 只能读取：当前快照、快照内服务端确认的父结果摘要（如有）和系统 Prompt。

评价 AI 只能读取：冻结实验与 Rubric、用户 Markdown、固定 Reflection、快照中必要现实门槛、父轮 unknowns（仅子会话）和系统 Prompt。

两者都不得读取：历史聊天、其他会话、其他职业、客户端构造的 `workValidation`、公开链接页面、附件、变化后的上游报告或未经服务端确认的新来源。用户 Markdown 以惰性 JSON 包装并标记为不可信数据。输出再次通过 Zod 校验 nextAction 组合、证据维度、三态和唯一下一步。

## 13. 实验生成与 Fallback

正常实验必须包含场景、角色、任务、输入、步骤、交付物、Rubric 和时间。强监管或不能安全模拟的职业不得伪造线上体验。

1. **完整确定性实验**：仅当冻结 `workValidation` 足以安全构造完整实验时使用，不得伪造事实或职业体验。
2. **岗位真相验证**：有 1–3 个真实来源但无法构造完整实验时，让用户提炼重复任务、重复要求、最大入场缺口、最不能接受的工作内容，并交付一页现实核对结果。
3. **职业核心工作认知**：完全无市场来源时明确“当前实时岗位证据不足”，只验证对核心工作的理解，不声称来自招聘市场。

不得仅根据 `workValidation.validationPath[0]` 强行拼装复杂实验。

## 14. 评价原则与 NextAction

- 顺序固定：观察 → 解释 → 冲突证据 → 未知 → 三态 → 一个下一步。
- 能力表现、工作体验、学习反应、现实可行性和外部反馈分别出证据。
- 喜欢但表现弱不得直接判“不适合”；表现强但体验差不得直接判“适合”。
- reasoning 必须解释证据冲突。
- nextAction 优先现实验证；只有站内实验有明确增量信息价值时才使用 `in_product_experiment`。

| 类型 | 默认 CTA | 创建会话 |
|---|---|---|
| `in_product_experiment` | 开始下一轮验证 | 用户主动点击后创建 |
| `external_validation` | 查看行动方法 | 否 |
| `market_contact` | 开始市场验证 | 否 |
| `bridge_path` | 查看过渡路径 | 否 |
| `credential_check` | 查看资格核实步骤 | 否 |
| `real_project` | 查看真实项目建议 | 否 |
| `pause` | 暂时保留这个方向 | 否 |

分析 API 只保存 nextAction，绝不预签子 capability。现实行动在 V1 只展示说明，不建立伪进度或空会话。

## 15. Supabase 最终结构

当前项目没有统一 session/report retention 策略，因此验证器使用独立可配置策略，不修改现有报告或支付表。

```sql
create table public.career_validation_sessions (
  id uuid primary key,
  report_id text not null,
  career_id text not null,
  parent_validation_session_id uuid null
    references public.career_validation_sessions(id) on delete set null,
  status text not null,
  validation_context_snapshot jsonb null,
  experiment jsonb null,
  experiment_version integer null,
  submission jsonb null,
  reflection jsonb null,
  result jsonb null,
  generation_metadata jsonb null,
  revision integer not null default 1,
  operation_kind text null,
  operation_token text null,
  operation_lease_expires_at timestamptz null,
  capability_issued_at timestamptz not null,
  capability_expires_at timestamptz not null,
  retention_expires_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null
);

create unique index career_validation_one_child_per_parent
  on public.career_validation_sessions(parent_validation_session_id)
  where parent_validation_session_id is not null;
```

- 快照创建后不可更新；实验、版本和结果只能从 null 写入一次；三者仅在删除时清空。
- `completed` 不接受内容 PATCH，`deleted` 不接受业务操作。
- 模型调用通过 `operation_kind + operation_token + operation_lease_expires_at` 实现跨实例并发 claim；成功、失败或删除后清空 lease。
- 状态使用 CHECK 约束；RLS 开启并 revoke `anon, authenticated`。
- tombstone 仅保留 ID、绑定字段、状态、capability/retention 时间、revision 和审计时间；所有用户内容 JSON 与 operation lease 均清空。

## 16. 数据生命周期与删除

- capability TTL：`CAREER_VALIDATION_CAPABILITY_TTL_SECONDS`，默认 30 天。
- 服务端 retention：`CAREER_VALIDATION_RETENTION_DAYS`，默认 180 天，可配置，不假设永久保存。
- 创建时写入固定 `retention_expires_at`；后来调整配置不追溯已有会话，避免生命周期漂移。
- 到期任务先清除用户内容，保留最小 tombstone 至 capability 过期和短期防重放窗口结束，之后可物理删除。物理删除以 `ON DELETE SET NULL` 解除仍存子会话的外键；子快照中的父结果摘要不受影响。
- tombstone 存在时返回 `410 SESSION_GONE`；tombstone 物理清除后返回稳定的 `404 SESSION_NOT_FOUND`。
- local envelope 保存 `retentionExpiresAt` 并在到期加载时清理。
- 用户可二次确认后删除当前会话；不级联父/子会话，不影响基础报告、职业专项报告、支付或其他实验。

## 17. UI/UX

五步渐进流程：验证目标、岗位真相、真实工作样本、提交与固定复盘、验证结果。

- 真实岗位证据和 AI 综合分析视觉分区。
- 少于 3 个来源不补造；完全无来源进入 unavailable。
- 强监管职业优先显示准入门槛，缺官方来源时标“待官方核实”。
- 沿用现有晨光主题；375 / 390 / 430 px 单列，无表格或横向滚动。
- 顶部步骤条紧凑，当前任务、交付物和 CTA 优先。
- sticky CTA 不遮挡 textarea；点击目标不小于 44 px。
- Markdown 作为纯文本，不引入渲染依赖。
- loading、empty、partial、error、saved、resumed、conflict、completed、expired、deleted 均有恢复路径。
- 未同步草稿离开时使用浏览器原生提醒。
- 增加“删除本次验证记录”入口，使用次要危险样式并二次确认，明确“不影响原报告”。
- 只有站内实验 CTA 调用 `/next`。

## 18. Analytics、安全与隐私

事件：`career_validation_started`、`job_reality_viewed`、`experiment_started`、`experiment_completed`、`reflection_completed`、`validation_result_viewed`、`next_action_viewed`、`next_experiment_clicked`、`career_validation_deleted`、`career_validation_abandoned`。

只发送职业 ID 的不可逆短标识、步骤、耗时、恢复/冲突状态、实验层级和 nextAction 类型。禁止发送正文、链接、反思、出生信息、收入或城市。

安全要求：

- 公开链接只允许 HTTPS，不 fetch、不预览、不传模型。
- Markdown 按纯文本处理，不用 `dangerouslySetInnerHTML`。
- 市场来源只能来自服务端认可的冻结快照。
- API 限制正文/notes 长度、调用频率、实验层级和幂等键。
- 系统 Prompt 正文不保存，只记录版本和模型 ID。
- 内容清除 tombstone 防止旧 capability 重放重建会话。

## 19. 兼容与迁移

- `CareerReportSchema` 保持兼容，`workValidation` 继续可选。
- 报告 SSE 新增可选 `validationAccess`，旧客户端可忽略。
- `DeepFlowState` 新增可选访问映射时提升版本并提供 V3 → V4 迁移，不删除旧报告。
- 验证器使用独立 localStorage envelope，不与深度报告 `sessionStorage` 混合。
- Supabase 使用独立 migration，不修改 `deep_report_sessions`、支付表或基础报告表。
- `lib/gemini/prompt.ts` 不在范围内，实施时不得修改、暂存或格式化。

## 20. 测试策略

### 快照、Schema 与可信输入

1. 快照创建后不可改变。
2. 上游报告变化时，已有实验继续使用旧快照。
3. 快照只接受绑定报告/职业和服务端认可来源。
4. `CareerExperimentSchema` 拒绝 `reflectionPrompts`。
5. Reflection 强制四字段和合法枚举。
6. publicResultUrl 不进入 Prompt，服务端不 fetch。
7. 其他 session、职业、历史聊天和客户端 workValidation 不进入 AI 输入。
8. generation metadata 正确持久化，Prompt 正文不持久化。

### Capability、API 与幂等

9. capability 绑定 report、career、session、scope 和有效期，不能跨会话。
10. TTL 来自配置，不依赖硬编码 30 天。
11. 重复创建/恢复得到同一快照。
12. 正常并发只允许一个 operation lease 持有者调用模型并保存一个实验；lease 超时重试的迟到结果不能落库。
13. 重复 analyze 返回同一结果且不预签子 capability。
14. 非站内 nextAction 不能创建子会话。
15. 合法站内 nextAction 创建唯一子会话，重复点击返回同一个。
16. 子会话不能修改父会话，父结果保持不可变。
17. experiment/analyze lease 超时后可以恢复，旧 operation token 的结果不能覆盖新结果。

### 并发、恢复与删除

18. expectedRevision 冲突返回 `409 VERSION_CONFLICT`。
19. 两标签页冲突时本地 Markdown 不丢失，双方不能静默覆盖。
20. 删除后不能生成、PATCH、分析或创建下一轮，删除期间的迟到 AI 结果不能落库。
21. 删除不影响原职业报告、基础报告、支付或其他会话。
22. 旧 capability 对 tombstone 返回 `410 SESSION_GONE`，tombstone 清除后返回 `404 SESSION_NOT_FOUND`。
23. retention 到期清除服务端内容和过期本地副本。

### Fallback、结果和 UI

24. 数据足够时可生成完整确定性 fallback。
25. 数据不足但有来源时退回岗位真相验证。
26. 无来源时退回职业核心工作认知且不伪造事实。
27. “表现正向 + 体验负向”能输出冲突证据。
28. “喜欢 + 表现弱”不能被直接判定“不适合”。
29. nextAction 只有一个且 type/canStartInProduct 组合合法。
30. 五步流程、安全提示、公开链接说明、冲突 UI、不同 CTA 和删除确认可用。
31. 375 / 390 / 430 px 在错误、冲突、删除和所有 nextAction 下无溢出，sticky CTA 不遮挡。

最终执行相关 tests、完整 tests、`tsc --noEmit`、lint 和生产 build。基础提示词旧断言与用户未提交 prompt 的不一致独立记录，不允许通过覆盖 `lib/gemini/prompt.ts` 解决。

## 21. 设计审查结论

已消除：

- **数据漂移**：完整上下文一次冻结，后续不读取变化的报告。
- **Capability 越权**：绑定字段、scope、状态、过期和 tombstone 联合校验。
- **幂等漏洞**：实验/评价使用带 token 的 operation lease，父会话唯一子索引，删除 tombstone 防重放；迟到模型结果不能覆盖新状态。
- **错误创建子会话**：只有合法站内 nextAction 且用户主动点击才调用 `/next`。
- **用户数据无法删除**：单会话内容清除与配置化 retention。
- **不可信输入污染**：白名单排除 URL、附件、历史聊天和客户端来源。
- **Search 污染**：市场事实只来自服务端认可快照。
- **草稿覆盖**：expectedRevision 与显式冲突 UI。
- **父子污染**：子会话只复制父快照和最小结果摘要，父会话不可变。
- **模型升级不可追踪**：持久化 generator/prompt/rubric/model 版本。

V1 复杂度控制：不增加登录、文件上传、链接抓取、外部行动反馈、实时协同或第二套职业推荐模型；删除仅作用于单 session。

未确认决策：无阻塞实施的产品决策。Capability 默认 30 天、服务端 retention 默认 180 天均来自配置，可在上线前调整，不影响 Schema 或核心逻辑。

## 22. 验收清单

- [ ] 具备前置依据的职业卡有 CTA 和绑定 capability。
- [ ] 创建时冻结完整快照，后续不读取变化的上游报告。
- [ ] 实验接近真实工作或安全降级，有明确交付物与 Rubric。
- [ ] 实验不含动态 `reflectionPrompts`。
- [ ] Markdown、公开链接和固定四项复盘可恢复，链接未被 AI 读取。
- [ ] 冲突不静默覆盖任一草稿。
- [ ] 结果独立呈现能力与体验，只给一个 nextAction。
- [ ] 现实 nextAction 不建 session；站内 nextAction 点击后只建一个子 session。
- [ ] 父会话和上一轮结果保持不可变。
- [ ] 用户可删除单次验证，原报告和其他会话不受影响。
- [ ] TTL、retention、生成与评价版本可追踪。
- [ ] 无实时来源时明确降级，不伪造事实。
- [ ] 监管或线下职业不生成虚假线上实验。
- [ ] 375 / 390 / 430 px 可用。
- [ ] 不修改基础报告 prompt、支付核心、职业专项报告和品牌视觉。
