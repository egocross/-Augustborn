# 专项深度分析付费闭环设计

## 1. 目标

在现有「出生信息 → 免费基础报告」之后增加一套可运行的 MVP 付费闭环，用于验证用户是否愿意在看完免费报告后，再回答几个现实问题并为更具体的专项分析付费。

产品继续定位为现代自我探索与现实决策辅助工具，不使用算命、命理、宿命、吉凶等前端语言或视觉符号。

## 2. 范围与非目标

### 2.1 本期范围

- 免费报告底部的专项分析入口。
- 四个标准方向的固定五题问卷。
- 自定义问题及最多 3–5 个 AI 补充问题。
- 统一的可选补充信息。
- Mock Payment 完整状态。
- 支付成功后的专项 AI 分析。
- 结构化、移动端优先的深度报告。
- 当前浏览器 Session 的恢复与错误重试。
- 可选 Supabase 最小持久化。

### 2.2 非目标

- 不重构、替换或改变现有免费分析。
- 不做登录、账户、历史订单或后台管理系统。
- 不接真实微信支付、支付宝或 Stripe。
- 不在 V1 接真实城市数据源。
- 不让 AI 生成或改写 A/B/C/D 的固定题库。
- 不显示「解锁剩余内容」等人为制造信息缺口的文案。

## 3. 已选架构方案

采用「现有单页流程内增加独立深度分析状态机」。

```text
现有出生表单
  → 现有免费分析 API
  → 现有免费报告
  → 现有反馈区
  → DeepAnalysisFlow
      ├─ 方向选择
      ├─ 固定题库 / 自定义问题
      ├─ 统一补充信息
      ├─ Mock Payment
      ├─ 专项报告生成
      └─ 结构化深度报告
```

现有 `/api/analyze`、免费报告 Schema、免费报告渲染与反馈功能保持原有责任。

## 4. 完整用户路径

1. 用户填写出生信息并获得免费基础报告。
2. 免费报告完整显示后，页面保留现有反馈区，然后显示专项分析入口。
3. 用户选择 A/B/C/D 或「我有其他问题」。
4. 进入聚焦的单题向导界面；免费报告保留在状态中，不在每题上方重复显示。
5. A/B/C/D 回答固定 5 题；自定义方向先输入问题，再回答 AI 判定为必要的 0–5 个补充问题。
6. 进入统一可选补充信息页。
7. 进入按方向动态命名的付费页，显示 `DEEP_REPORT_PRICE`。
8. Mock Payment 成功后请求专项报告。
9. 生成时显示真实阶段文案，不显示虚假百分比。
10. 报告生成成功后显示结构化报告；失败时保留所有答案和已支付状态，可原地重试。

## 5. 方向选择入口

标题：「接下来，你最想进一步弄清楚什么？」

副标题：「选择一个你现在最关心的问题，我们会结合你的基础分析和现实情况继续深入。」

标准方向：

- `work`：我适合做什么工作
- `industry`：我适合进入什么行业
- `city`：我更适合在哪类城市发展
- `collaboration`：我适合怎样的工作环境与合作关系
- `custom`：我有其他问题

V1 不显示「建议优先探索」，因为当前没有稳定、可验证的推荐规则。以后增加该标记时必须有明确依据，不得伪装成 AI 权威判断。

## 6. 题库数据模型

题库放在单独配置文件，不散落在 React 组件。

```ts
type DirectionId = 'work' | 'industry' | 'city' | 'collaboration' | 'custom';

type QuestionType = 'single' | 'multi' | 'text';

type QuestionOption = {
  id: string;
  label: string;
};

type FixedQuestion = {
  id: string;
  directionId: Exclude<DirectionId, 'custom'>;
  type: QuestionType;
  text: string;
  options?: QuestionOption[];
  required: boolean;
  maxSelect?: number;
  supplementaryField?: {
    id: string;
    label: string;
    placeholder?: string;
    required: boolean;
    maxItems?: number;
  };
};
```

固定版本：

```ts
export const QUESTIONNAIRE_VERSION = 'v1';
```

答案只记录稳定 ID：

```ts
type QuestionnaireAnswer = {
  questionId: string;
  optionIds?: string[];
  textValue?: string;
  supplementaryValue?: string[];
};
```

## 7. V1 固定题库

### 7.1 A：我适合做什么工作

#### `work_q1` 单选，必填

「你目前处于什么状态？」

- `work_q1_employed_stay`：在职，目前不考虑换工作
- `work_q1_employed_change`：在职，但正在考虑换工作
- `work_q1_job_seeking`：待业 / 正在找工作
- `work_q1_student`：学生
- `work_q1_freelance`：自由职业
- `work_q1_entrepreneur`：创业 / 个体经营
- `work_q1_other`：其他

#### `work_q2` 多选，必填

「过去你主要做过哪些类型的事情？」

- `work_q2_sales`：销售 / 商务
- `work_q2_content`：内容创作
- `work_q2_design`：设计 / 审美
- `work_q2_technology`：技术 / 工程
- `work_q2_operations`：运营 / 行政
- `work_q2_service`：客户服务 / 与人沟通
- `work_q2_education`：教育 / 培训
- `work_q2_management`：管理 / 组织
- `work_q2_manual`：手工 / 实操
- `work_q2_research`：研究 / 分析
- `work_q2_limited_experience`：工作经历较少
- `work_q2_other`：其他

#### `work_q3` 多选，必填

「哪些事情你做起来会感觉更自然？」

- `work_q3_strangers`：和陌生人交流
- `work_q3_persuade`：说服别人接受自己的想法
- `work_q3_analyze`：分析复杂问题
- `work_q3_ideas`：提出新的点子
- `work_q3_organize`：把混乱的事情整理清楚
- `work_q3_hands_on`：动手解决实际问题
- `work_q3_independent_research`：长期独立研究某个问题
- `work_q3_drive_projects`：组织资源并推进事情完成
- `work_q3_guide`：帮助或指导别人
- `work_q3_trends`：发现机会和趋势
- `work_q3_uncertain`：暂时不确定

#### `work_q4` 多选，必填，`maxSelect: 3`

「你最不希望长期处于哪种工作状态？」

- `work_q4_repetitive`：高度重复
- `work_q4_social`：高频社交
- `work_q4_isolated`：长时间独处
- `work_q4_controlled`：被严格管理
- `work_q4_trivial`：大量琐碎事务
- `work_q4_competitive`：高压竞争
- `work_q4_unstable_income`：收入不稳定
- `work_q4_travel`：经常出差
- `work_q4_office`：长时间坐办公室
- `work_q4_change`：工作内容经常变化
- `work_q4_none`：没有明显排斥

#### `work_q5` 多选，必填，`maxSelect: 2`

「现阶段，你选择工作最看重什么？」

- `work_q5_income`：提高收入
- `work_q5_stability`：稳定
- `work_q5_freedom`：自由
- `work_q5_growth`：快速成长
- `work_q5_achievement`：成就感
- `work_q5_balance`：工作与生活平衡
- `work_q5_future`：长期发展前景

### 7.2 B：我适合进入什么行业

#### `industry_q1` 单选，必填

「你目前主要处在哪个行业？」

- `industry_q1_technology`：互联网 / 软件 / AI
- `industry_q1_retail`：电商 / 零售 / 消费品
- `industry_q1_media`：内容 / 传媒 / 广告
- `industry_q1_education`：教育 / 培训
- `industry_q1_finance`：金融 / 保险 / 投资
- `industry_q1_health`：医疗 / 健康
- `industry_q1_manufacturing`：制造业 / 工业
- `industry_q1_real_estate`：建筑 / 房地产
- `industry_q1_hospitality`：餐饮 / 酒店 / 旅游
- `industry_q1_logistics`：物流 / 交通 / 供应链
- `industry_q1_professional`：专业服务（咨询、法律、财税等）
- `industry_q1_public`：政府 / 公共事业
- `industry_q1_culture`：文化 / 艺术 / 设计
- `industry_q1_environment`：农业 / 环境 / 能源
- `industry_q1_self_employed`：自由职业 / 个体经营
- `industry_q1_student`：学生 / 暂未进入职场
- `industry_q1_other`：其他

#### `industry_q2` 单选，必填

「你对更换行业的接受程度？」

- `industry_q2_stay`：暂时不想换行业，只想换岗位
- `industry_q2_adjacent`：可以换到相近行业
- `industry_q2_cross`：只要更适合我，可以跨行业
- `industry_q2_restart`：愿意彻底重新开始
- `industry_q2_uncertain`：目前不确定

#### `industry_q3` 多选，必填，`maxSelect: 3`

「现在选择行业，你最看重什么？」

- `industry_q3_income_ceiling`：收入上限高
- `industry_q3_stable_income`：收入稳定
- `industry_q3_growth`：行业长期增长
- `industry_q3_jobs`：容易找到工作
- `industry_q3_personal_growth`：个人成长速度
- `industry_q3_strengths`：能发挥自己的优势
- `industry_q3_meaning`：工作有意义 / 有价值感
- `industry_q3_time`：时间比较自由
- `industry_q3_entrepreneurship`：有创业或副业机会
- `industry_q3_location`：地域限制较少
- `industry_q3_simple_relations`：人际关系相对简单
- `industry_q3_intensity`：工作强度相对可控

#### `industry_q4` 单选，必填

「你更偏好哪类行业环境？」

- `industry_q4_mature`：成熟稳定、规则清晰的大行业
- `industry_q4_emerging`：快速增长、机会较多的新兴行业
- `industry_q4_niche`：小而专业的细分行业
- `industry_q4_creative`：创意和变化较多的行业
- `industry_q4_service`：与人强相关的服务型行业
- `industry_q4_expertise`：技术 / 专业能力驱动的行业
- `industry_q4_uncertain`：暂不确定

#### `industry_q5` 单选，必填

「你对行业不确定性的接受程度？」

- `industry_q5_very_low`：很低：更希望稳定、可预测
- `industry_q5_low`：较低：可以接受少量变化
- `industry_q5_medium`：中等：稳定和机会都重要
- `industry_q5_high`：较高：愿意承担风险换成长
- `industry_q5_very_high`：很高：愿意进入早期行业或创业型领域

### 7.3 C：我更适合在哪类城市发展

#### `city_q1` 文本，必填

「你目前主要生活在哪个城市？」

placeholder：「例如：广州 / 成都 / 东京」

#### `city_q2` 单选，必填

「你能够接受的发展范围？」

- `city_q2_current`：只考虑目前所在城市
- `city_q2_nearby`：可以考虑同省 / 周边城市
- `city_q2_domestic`：可以考虑国内其他城市
- `city_q2_major`：一线 / 新一线城市都可以
- `city_q2_small`：中小城市也可以
- `city_q2_overseas`：可以考虑海外
- `city_q2_global`：全球范围都可以
- `city_q2_uncertain`：暂时不确定

附加非必填字段 `city_q2_candidates`：「已经有考虑的城市？」，最多 5 个城市，按中英文逗号、顿号、斜杠或换行拆分并去重。

#### `city_q3` 多选，必填，`maxSelect: 3`

「选择城市时，你最看重什么？」

- `city_q3_jobs`：工作机会多
- `city_q3_income`：收入水平高
- `city_q3_industry`：所在行业发展好
- `city_q3_business`：创业 / 商业机会多
- `city_q3_cost`：房租和生活成本低
- `city_q3_housing`：买房压力较小
- `city_q3_pace`：生活节奏舒适
- `city_q3_climate`：气候适合
- `city_q3_nature`：自然环境好
- `city_q3_services`：公共服务 / 医疗 / 教育好
- `city_q3_culture`：社交和文化生活丰富
- `city_q3_family`：离家人近
- `city_q3_international`：国际化程度高
- `city_q3_transport`：交通便利

#### `city_q4` 单选，必填

「未来 3–5 年，你更可能采取哪种发展方式？」

- `city_q4_stable_job`：找一份稳定工作
- `city_q4_high_income`：寻找高收入职业机会
- `city_q4_specialize`：深耕某个专业领域
- `city_q4_freelance`：做自由职业
- `city_q4_entrepreneur`：创业 / 做自己的生意
- `city_q4_online`：做线上业务，不强依赖城市
- `city_q4_side_project`：边工作边尝试副业
- `city_q4_uncertain`：目前还没有明确方向

#### `city_q5` 多选，必填

「哪些现实条件会限制你选择城市？」

- `city_q5_partner`：家庭 / 伴侣
- `city_q5_children`：孩子教育
- `city_q5_parents`：父母养老
- `city_q5_property`：房产
- `city_q5_residency`：户籍 / 签证
- `city_q5_job`：当前工作
- `city_q5_income`：收入水平
- `city_q5_move_cost`：迁移成本
- `city_q5_language`：语言
- `city_q5_climate`：对当地气候的适应
- `city_q5_distance`：不愿离家太远
- `city_q5_none`：没有明显限制
- `city_q5_other`：其他

### 7.4 D：我适合怎样的工作环境与合作关系

#### `collaboration_q1` 单选，必填

「工作时，你更舒服的状态是？」

- `collaboration_q1_independent`：大部分时间独立完成
- `collaboration_q1_independent_first`：独立工作为主，必要时合作
- `collaboration_q1_balanced`：独立与团队各一半
- `collaboration_q1_team`：团队协作为主
- `collaboration_q1_social`：高频与人交流、协作
- `collaboration_q1_uncertain`：不确定

#### `collaboration_q2` 单选，必填

「你更喜欢哪种工作环境？」

- `collaboration_q2_stable`：稳定、有明确流程和规则
- `collaboration_q2_autonomous`：目标明确，但执行方式比较自由
- `collaboration_q2_dynamic`：变化快、不断解决新问题
- `collaboration_q2_creative`：创意导向，允许大量尝试
- `collaboration_q2_competitive`：高竞争、高绩效、高回报
- `collaboration_q2_calm`：节奏相对平稳、压力较低
- `collaboration_q2_small_team`：小团队、灵活直接
- `collaboration_q2_uncertain`：暂不确定

#### `collaboration_q3` 多选，必填，`maxSelect: 2`

「你更喜欢什么样的领导或合作伙伴？」

- `collaboration_q3_clear`：给清晰目标和规则
- `collaboration_q3_autonomy`：给我充分自主权
- `collaboration_q3_mentor`：能教我、带我成长
- `collaboration_q3_decisive`：决策果断、执行力强
- `collaboration_q3_stable`：情绪稳定、沟通直接
- `collaboration_q3_creative`：有创意、敢于尝试
- `collaboration_q3_data`：逻辑强、重视数据
- `collaboration_q3_resources`：擅长关系和资源整合
- `collaboration_q3_complementary`：能互补我的短板
- `collaboration_q3_peer`：不希望有明显上下级关系

#### `collaboration_q4` 多选，必填，`maxSelect: 3`

「哪些合作方式最让你难以长期接受？」

- `collaboration_q4_micromanagement`：微观管理，什么都要管
- `collaboration_q4_changing_goals`：目标经常改变
- `collaboration_q4_unclear`：权责不清
- `collaboration_q4_politics`：办公室政治严重
- `collaboration_q4_emotional`：情绪化沟通
- `collaboration_q4_meetings`：大量无意义会议
- `collaboration_q4_social`：高频社交和应酬
- `collaboration_q4_overtime`：长期加班
- `collaboration_q4_internal_competition`：内部竞争严重
- `collaboration_q4_slow`：做事非常慢、流程繁琐
- `collaboration_q4_feedback`：缺少反馈
- `collaboration_q4_repetitive`：工作内容长期重复
- `collaboration_q4_none`：没有明显排斥

#### `collaboration_q5` 单选，必填

「你理想中的长期工作形态更接近哪一种？」

- `collaboration_q5_corporate`：大公司稳定岗位
- `collaboration_q5_professional`：专业型公司 / 专业岗位
- `collaboration_q5_startup`：小团队 / 创业公司
- `collaboration_q5_freelance`：自由职业
- `collaboration_q5_entrepreneur`：独立创业
- `collaboration_q5_remote`：远程工作
- `collaboration_q5_project`：项目制工作
- `collaboration_q5_portfolio`：主业 + 副业
- `collaboration_q5_uncertain`：暂时不确定

## 8. 统一补充信息

问题：「还有什么现实情况希望我们考虑？」

说明：「例如：收入压力、家庭情况、学历限制、已经考虑的职业或城市等。只填写你认为会影响判断的信息。」

- 字段 ID：`optional_context`
- 类型：自由文本
- 非必填
- 最长 2,000 字符

## 9. 自定义问题

用户选择 `custom` 后：

1. 显示「你现在最想解决什么问题？」。
2. 输入必填，最长 500 字符。
3. 后端 AI 判断是否需要追问。
4. 如不需要，直接进入统一补充信息页。
5. 如需要，返回 3–5 题；不允许返回 1–2 题后再人为补足。
6. 问题优先使用单选或多选，只在无法用简短选项表达时使用文本题。
7. 每题必须直接影响最终判断，长度受 Schema 限制。
8. 动态问题当次会话使用 `custom_q1` 至 `custom_q5` 稳定顺序 ID。

## 10. 问卷交互

- 一次只展示一题。
- 顶部只显示真实进度，例如 `2 / 5`。
- 单选和多选选项都是大尺寸卡片按钮。
- 单选后不自动跳转，由用户主动点击下一题，避免误操作。
- 多选达到 `maxSelect` 后禁止继续勾选，并显示「最多选择 N 项」。
- 返回上一题保留答案。
- 返回方向选择时保留已答内容；如改选方向，另一方向的答案在当前 Session 中保留，但不提交给当前报告。
- 每题通过校验后才能继续。
- 选项最小点击高度 48px。

## 11. 付费页与 Mock Payment

付费发生在问卷和可选补充信息完成之后。

标题映射：

- `work`：你的职业方向深度分析已经准备好
- `industry`：你的行业方向深度分析已经准备好
- `city`：你的城市发展分析已经准备好
- `collaboration`：你的工作方式与合作关系分析已经准备好
- `custom`：你的专项深度分析已经准备好

说明文案表达：系统将综合基础分析、现实经历、当前目标、限制条件和当前最关心的问题生成专项分析。

- CTA：「生成我的深度报告」
- 价格：`DEEP_REPORT_PRICE`，首版值为 `¥29.90`
- 价格由服务端页面传入客户端，不在组件中写死。

Mock Payment 服务接口：

```ts
type PaymentStatus = 'unpaid' | 'processing' | 'paid' | 'failed';

type PaymentReceipt = {
  sessionId: string;
  directionId: DirectionId;
  paidAt: string;
  signature: string;
};

interface PaymentService {
  pay(input: { sessionId: string; directionId: DirectionId }): Promise<PaymentReceipt>;
}
```

Mock 后端返回 HMAC 签名凭证，专项报告 API 校验 `sessionId`、`directionId`、`paidAt` 和签名，不接受客户端单纯声明「已支付」。

`MOCK_PAYMENT_OUTCOME=success|failure` 用于测试成功和失败，默认 `success`。未支付和支付中是客户端状态机的真实状态。

## 12. 专项分析输入

客户端提交：

```ts
type DeepAnalysisRequest = {
  sessionId: string;
  paymentReceipt: PaymentReceipt;
  birthInput: {
    birthDate: string;
    birthTime: string | null;
    birthRegion: string;
  };
  freeReport: Report;
  selectedDirection: DirectionId;
  questionnaireVersion: 'v1';
  answers: QuestionnaireAnswer[];
  optionalContext: string;
  customQuestion: string | null;
  customQuestions: DynamicQuestion[];
};
```

后端必须：

1. 校验 Mock 支付凭证。
2. 重新验证出生输入并计算内部结构。
3. 用确定性代码将免费报告转为结构化摘要，不为摘要额外调用 AI。
4. 根据题库校验题目 ID、选项 ID、必填、多选上限和题库版本。
5. 仅组合当前选中方向的答案。
6. 构造下面的服务端模型输入：

```ts
type DeepModelInput = {
  birth_profile: Record<string, unknown>;
  free_report_summary: {
    sections: Array<{ heading: string; summary: string; bullets: string[] }>;
  };
  selected_direction: DirectionId;
  questionnaire_version: 'v1';
  answers: QuestionnaireAnswer[];
  optional_context: string;
  custom_question: string | null;
  city_context: Record<string, unknown> | null;
};
```

## 13. Prompt 与 AI 服务边界

文件边界：

```text
lib/deep-analysis/
  prompts/
    base.ts
    work.ts
    industry.ts
    city.ts
    collaboration.ts
    custom.ts
  ai-service.ts
  schemas.ts
  types.ts
  summarize-free-report.ts
  city-data-provider.ts
```

`base.ts` 通用规则：

- 不迎合、不恭维、不凭空补全事实。
- 区分用户提供的现实信息、可验证推断和无法确定的部分。
- 使用「更可能」「更倾向」「值得优先探索」「可以重点验证」等探索式表达。
- 禁止宿命化、吉凶化、恐吓或结果承诺。
- 正文禁止传统命理与玄学术语。
- 给出可执行建议、适用边界和小成本验证方法。
- 不提供医疗、法律、投资或心理诊断建议。
- 只返回符合 Schema 的简体中文 JSON。

方向 Prompt 只负责本方向的价值深度和决策粒度，不重复通用规则。UI 不导入 Gemini SDK，只请求后端 API。

V1 复用当前官方 Gemini 配置：

- `GEMINI_API_KEY`
- `GEMINI_MODEL`（缺省 `gemini-3.1-pro-preview`）
- `GEMINI_REASONING_EFFORT`

## 14. 城市数据接口

```ts
interface CityDataProvider {
  getContext(input: {
    currentCity: string;
    candidateCities: string[];
    answers: QuestionnaireAnswer[];
  }): Promise<Record<string, unknown> | null>;
}
```

V1 使用 `EmptyCityDataProvider`，返回 `null`。城市 Prompt 必须明确区分倾向分析与缺少真实数据时无法下结论的项目，不得伪造薪资、房租或就业数据。

## 15. 深度报告 Schema

报告共享通用呈现字段，但不固定业务章节名称或卡片数量。

```ts
type DeepReport = {
  title: string;
  summary: string;
  keyFindings: string[];
  cards: Array<{
    id: string;
    title: string;
    summary: string;
    details: string[];
    evidence: string[];
  }>;
  risks: Array<{
    title: string;
    detail: string;
    mitigation: string;
  }>;
  nextActions: Array<{
    title: string;
    detail: string;
    timeframe: string;
  }>;
  reflectionQuestions: string[];
  disclaimer: string;
};
```

限制：

- `keyFindings`：2–5 条。
- `cards`：2–6 张，具体标题和内容由方向 Prompt 决定。
- `risks`：1–4 条。
- `nextActions`：2–5 条。
- `reflectionQuestions`：0–4 条。
- 所有字段都经过 Zod 校验和长度限制。

UI 将渲染标题、摘要、重点结论、动态卡片、风险提醒、下一步行动与可选的展开详情，不渲染一整篇 Markdown。

## 16. API 设计

### 16.1 `POST /api/deep-analysis/custom-questions`

输入：`sessionId`、`customQuestion`、免费报告摘要。

输出：

```ts
type DynamicQuestionResponse = {
  questions: DynamicQuestion[]; // 0 或 3–5
};
```

错误：`invalid_input`、`timeout`、`upstream_failed`、`parse_failed`。

### 16.2 `POST /api/deep-analysis/payment`

输入：`sessionId`、`directionId`。

输出：签名 `PaymentReceipt`或 `payment_failed`。

### 16.3 `POST /api/deep-analysis/report`

输入：`DeepAnalysisRequest`。

返回 SSE：

```ts
type DeepReportStreamEvent =
  | { type: 'status'; stage: 'organizing' | 'calibrating' | 'analyzing' | 'writing' }
  | { type: 'report'; report: DeepReport }
  | { type: 'error'; code: DeepReportErrorCode; message: string };
```

不将模型内部思考、日志或原始响应透传给前端。

### 16.4 `POST /api/deep-analysis/session`

最小里程碑持久化：方向已选、问卷已完成、支付状态、报告状态和结构化报告。

Supabase 未配置或写入失败时，返回可识别的 `persistence_unavailable`，但不阻断问卷、Mock 支付或报告生成。

## 17. 客户端状态机

```ts
type DeepFlowStep =
  | 'selection'
  | 'fixed-questionnaire'
  | 'custom-question'
  | 'custom-follow-up-loading'
  | 'custom-follow-up'
  | 'optional-context'
  | 'payment'
  | 'generating'
  | 'report'
  | 'error';
```

状态至少包含：

- `sessionId`
- `step`
- `selectedDirection`
- `questionnaireVersion`
- `answersByDirection`
- `currentQuestionIndex`
- `optionalContext`
- `customQuestion`
- `customQuestions`
- `paymentStatus`
- `paymentReceipt`
- `reportStatus`
- `deepReport`
- `lastError`

每个转移由 reducer 明确定义，组件不分散组合互相矛盾的布尔状态。

## 18. Session 恢复与隐私

客户端使用 `sessionStorage` 键 `jianvia.deep-analysis.v1`：

- 只在用户进入深度分析流程后写入。
- 保存当前出生输入、免费报告、方向、答案、步骤、Mock 支付凭证和深度报告。
- 页面刷新后可恢复。
- 关闭标签页后由浏览器自动失效。
- 点击「重新分析」时明确删除。
- 不使用 `localStorage`、Cookie 或 URL 参数存放出生信息。

Supabase 禁止保存：

- 原始出生日期
- 原始出生时间
- 原始出生地区
- 模型原始请求和原始响应
- 密钥、支付密钥或服务角色凭证

## 19. Supabase 最小数据模型

表：`deep_report_sessions`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 客户端生成的匿名 session ID |
| `selected_direction` | text | 方向 ID |
| `questionnaire_version` | text | `v1` |
| `answers` | jsonb | 题目 ID 和选项 ID，不含出生信息 |
| `optional_context` | text | 可选现实补充，允许为空 |
| `custom_question` | text | 自定义问题，允许为空 |
| `payment_status` | text | `unpaid/processing/paid/failed` |
| `report_status` | text | `not_started/generating/complete/failed` |
| `report_result` | jsonb | 结构化深度报告，允许为空 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

无登录情况下不给浏览器 Supabase 写入权限。所有写入通过后端 Service Role，Schema 校验后执行。RLS 启用且不建立 anon 策略。

## 20. 等待状态

专项报告生成期间轮播：

- 正在整理你的基础信息
- 正在结合你的现实情况
- 正在分析最值得优先探索的方向
- 正在生成专项报告

沿用现有深蓝灰玻璃弹窗语言，但深度分析使用独立阶段文案。不显示虚假百分比或虚假剩余时间。

## 21. 错误处理

错误代码：

- `invalid_input`：客户端数据不完整或题库验证失败。
- `payment_required`：无支付凭证。
- `payment_invalid`：支付凭证签名或方向不匹配。
- `payment_failed`：Mock Payment 失败。
- `timeout`：AI 请求超时。
- `upstream_failed`：模型或网络请求失败。
- `parse_failed`：模型响应无法通过 JSON/Zod 校验。
- `persistence_unavailable`：Supabase 未配置或写入失败。

客户端恢复：

- 支付失败：停留付费页，显示重试按钮。
- 自定义补充题失败：保留原问题，可重试；不自动跳过。
- 深度生成失败：保留已支付凭证和所有答案，只重试生成。
- 持久化失败：不阻断主流程，客户端 Session 仍然可用。
- 刷新：从 `sessionStorage` 恢复；如数据版本不兼容，只清除深度分析 Session，不影响已显示的免费报告。

超时策略固定为：

- 自定义补充问题请求：服务端 60 秒，客户端 70 秒主动中止。
- 深度报告请求：Vercel Function `maxDuration = 300`，服务端 240 秒中止上游请求，客户端 255 秒主动中止。
- 深度报告使用 SSE，每 15 秒至少发送一次阶段或 heartbeat 事件，防止用户误以为页面卡死。
- 若部署套餐无法支持 300 秒 Function，发布前验收直接失败，不静默降低模型、思考等级或报告质量。

## 22. 响应式与视觉

- 延续浅暖灰画布、现代无衬线字体、简洁卡片与克制动效。
- 不加入古典、算命或玄学装饰。
- 375px、390px、430px 为重点验收宽度。
- 所有选项卡片、主要按钮与导航按钮满足移动端点击面积。
- 不出现横向滚动。
- 长报告卡片默认显示摘要，详情可展开，避免首屏文字墙。
- `prefers-reduced-motion` 下关闭非必要动画。

## 23. 环境变量

| 变量 | 必需 | 用途 |
|---|---|---|
| `GEMINI_API_KEY` | 是 | 官方 Gemini API |
| `GEMINI_MODEL` | 否 | 模型覆盖，缺省 `gemini-3.1-pro-preview` |
| `GEMINI_REASONING_EFFORT` | 否 | `low/medium/high` |
| `DEEP_REPORT_PRICE` | 是 | 付费页价格，首版 `¥29.90` |
| `MOCK_PAYMENT_SECRET` | 是 | Mock 支付凭证 HMAC 签名 |
| `MOCK_PAYMENT_OUTCOME` | 否 | `success/failure`，默认 `success` |
| `SUPABASE_URL` | 否 | 会话里程碑持久化 |
| `SUPABASE_SERVICE_ROLE_KEY` | 否 | 仅服务端写入 Supabase |

## 24. 测试与验收

### 24.1 单元测试

- 四个固定方向各有且只有 5 题。
- 所有题目和选项 ID 唯一且稳定。
- 题库版本为 `v1`。
- 单选、多选、必填、文本长度和 `maxSelect` 校验正确。
- 城市候选项最多 5 个且去重。
- 支付凭证签名和验签正确。
- 自定义补充题只接受 0 或 3–5 题。
- 免费报告摘要为确定性结果。
- 五个方向 Prompt 独立且共享基础规则。
- 深度报告 Schema 验证成功与失败分支。

### 24.2 组件和状态测试

- 方向选择、逐题前进、返回、答案保留。
- 多选上限和明确提示。
- 统一补充字段可跳过。
- Session 刷新恢复与「重新分析」清理。
- Mock Payment 未支付、处理中、成功、失败和重试。
- 生成失败后不丢答案、不再次支付。
- 深度报告动态卡片和展开详情。

### 24.3 API 测试

- 非法输入被拒绝。
- 未支付或伪造凭证被拒绝。
- Mock 支付成功与失败。
- AI 超时、上游失败、空响应和解析失败。
- Supabase 缺失时主流程继续。
- 成功响应通过 Zod 并输出结构化报告。

### 24.4 完整路径

1. 免费报告 → 职业 A1–A5 → 补充信息 → Mock Payment → 职业深度报告。
2. 免费报告 → 城市 C1–C5 → Mock Payment → 城市深度报告。
3. 免费报告 → 工作环境 D1–D5 → Mock Payment → 深度报告。
4. 免费报告 → 自定义问题 → AI 判定 / 补充题 → Mock Payment → 深度报告。

以可控的 Mock AI 响应做端到端流程验证，不在自动测试中消耗真实 Gemini 额度。上线前另做一次真实 Gemini 烟雾测试。

### 24.5 最终命令

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## 25. 验收标准

- 现有免费报告流程和原有测试全部通过。
- 用户不会在刚选方向时看到付费页。
- A/B/C/D 题目与选项不由 AI 改变。
- 答题、返回、刷新、支付失败和生成失败都不丢失已填信息。
- 未支付无法调用深度报告 API。
- 深度报告比免费报告更具体，包含优先方向、不匹配条件、风险、验证实验和下一步行动。
- 前端不出现传统命理语言或视觉。
- 移动端 375px、390px、430px 无横向溢出，所有主要操作可舒适点击。
- 真实密钥不进入浏览器、代码库或日志。
- Supabase 不存储原始出生日期、时间或地区。

## 26. 交付报告要求

实施完成后汇报：

1. 修改文件。
2. 新增页面与组件。
3. 当前完整用户路径。
4. 固定题库位置。
5. `questionnaire_version` 实现。
6. Mock Payment 运行方式。
7. 深度 Prompt 位置。
8. 环境变量。
9. Supabase 增量。
10. 测试、Lint、TypeScript 与构建结果。
11. Mock 部分。
12. 已知问题。
13. 下一步最值得优先完成的一件事。
