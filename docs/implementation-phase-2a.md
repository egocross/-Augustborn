# Implementation Phase 2A — Birth Input & Deterministic Time Variants

交付日期：2026-10-07（Asia/Shanghai）。基线 HEAD：`1934d34`，分支 `codex/bazi-mvp`。

完整阅读 `integrated-advantage-report-v1.md` 后，按本轮 Phase 2A 授权实施第 11–12 节的确定性部分。仍未接入任何正式用户流程，也未开始 Gemini AI1。

## 文件与入口

| 文件 | 职责 |
| --- | --- |
| `lib/bazi/input-v2.ts` | strict 输入、支持范围声明与评估、置信派生、静态范围 |
| `lib/bazi/time-variant-calendar.ts` | 秒级历法适配、完整节气表检查、canonical chart 校验、库与算法版本 |
| `lib/bazi/time-variants.ts` | 确定性分段、去重、完整性校验、稳定柱集合与失败结果 |
| `lib/bazi/input-v2.test.ts` | 输入契约、历史范围、海外绕过、时间置信与静态范围测试 |
| `lib/bazi/time-variants.test.ts` | 节气/午夜/unknown/完整性/失败/确定性测试 |
| `lib/bazi/chart.ts`（修改） | 抽出 `calculateChartFacts` 复用原 `setSect(2)`、时干与五行计数，旧接口保持原行为 |
| 本文件 | 契约说明、验证证据与已知限制 |

`lib/validation.ts`、原 `chart.test.ts`、Phase 1 `signal-schema.ts` 均未修改。

公开流程：`prepareBirthInput(rawInput, rawDeclaration)` → `enumerateChartVariants(rawInput, rawDeclaration)`。枚举入口会重新执行支持范围检查，不能提交一个伪造的 `supported` assessment 来跳过检查。单独解析 `BirthInputV2Schema` 只表示格式合法，不代表获得排盘资格。

## BirthSupportAssessment

`BirthSupportDeclarationSchema` 要求显式提供：

- `reportedTimeBasis`: `beijing_standard | overseas_civil | unverified | historical_unverified`。
- `overseasDeclared`: boolean，无默认值。

`BirthSupportAssessment` 保留设计规定的四个字段：`status / reasonCode / reportedTimeBasis / overseasDeclared`。判定优先级：

1. 已声明海外，或口径为海外 civil time：`overseas_civil_time_unsupported`。
2. 已声明历史口径无法核实：`historical_time_basis_unverified`。
3. 口径未确认：`time_basis_unverified`。
4. 其余合法输入经过公农历日期换算及历史范围排除后，才为 `supported`，原因 null。

前三项在日期校验／历法转换之前短路。unavailable 不构建可排盘输入，不计算任何 chart。清空时间、改成 unknown、填 12:00、提交 Asia/Shanghai 或“已换算”都不能覆盖已声明的海外状态。未提供明确声明按非法声明处理，不默认为国内。

设计没有列出历史日期的具体白名单，本次明确采用 `birth-support-v1` 保守实施策略：排除公历 1950 年以前、1986–1991 全年；跨日范围检查两个实际公历日期，农历先换算日期。参考 [IANA tz 数据源中的中国历史说明及 Shang/PRC 规则](https://github.com/eggert/tz/blob/main/asia)。这是产品支持范围的保守排除，**并不表示这些年份的每一天都存在偏移问题**；也没有实现历史时区或 DST 转换器。用户自称已换算不提供例外。

## BirthInputV2 与 BirthTimeConfidence

严格保留 `schemaVersion/birthDate/calendarType/isLeapMonth/timezone/timeBasis/birthTime/timeRange/reportedPrecision/birthRegion?`。拒绝额外字段和用户提交的 `timeConfidence/same_shichen/cross_shichen`。

- 日期输入年沿用现有 1900–2100，校验真实公历日期、农历月天数与闰月存在性；公历不得声明农历闰月。
- exact：只有合法 `HH:mm`；沿用旧接口以 `HH:mm:00` 为计算时刻的语义。
- range：只有范围；`endDayOffset` 必填且只能为 0 或 1，结束不得早于开始，时长至多 24 小时。等起止同日为闭区间单点，等起止次日为完整 24 小时。
- unknown：时间与范围都为 null。
- `birthRegion` 可选，去首尾空白且最多 40 字符，不参与排盘判断或 chart identity。

代码根据闭区间实际覆盖的时支派生四种 confidence。跨午夜但同为子时可以是 `approximate_same_shichen`，依然会产生不同日柱／时干，confidence 不等于整盘稳定。

静态 `afternoon` 的实施定义为闭区间 12:00–18:00（同日），通过 `confirmedStaticTimeRange({ period: 'afternoon', confirmed: true })` 返回明确端点。未确认不返回范围；没有把“下午”偷偷变成 15:00。将来 UI 需要把这个明确定义展示给用户，本阶段没有 UI。

## 枚举、完整性与 canonical variants

- 固定 `lunar-typescript@1.8.6`、`sect=2`，版本 `bazi-sect2-time-variants-v1`。测试验证安装库版本，升级需重新审查和升版本。
- 全部时间运算用标准钟表日期及整数秒，不使用浏览器时区、主机 DST、系统当前时间、随机数或网络。
- 对覆盖日逐日读取完整 `JIE_QI_IN_USE` 表；依照库的月柱算法选取偶数位置的“节”边界，含立春。缺少任何表项则失败。
- 切点包含输入起点、时支切换、午夜、节气精确秒。每段起点及最后有效秒核对完整柱组合。
- 用户范围整体为闭区间；内部不重叠分段用 `[start,end)`，最后一段为 `[start,end]`。如果结束恰在新边界，该边界状态保留为闭区间单点，不丢弃。
- 每段保留 `segmentId/start/end/startInclusive/endInclusive/variantId/chartHash/knownPillars`，以及明确标注 `segment_representative_only` 的 `calculationPoint`。该点不写回 BirthInputV2，不声称是真实出生时间。
- chart hash 由四个柱位（含 null）、算法、库版本和排盘口径生成；相同完整柱组合去重，variant 保留所有对应 `segmentIds`。地点、代表点和持续时长不影响 chart identity。
- segment/variant ID 确定性生成；strict 输出 Schema 检查覆盖无间断且不重叠、引用完整、ID/hash 正确、已知柱与 confidence 一致。
- 仅完整成功后返回 `status=complete, coverageComplete=true` 并计算 `stablePillars`。某柱所有候选相同才保留，否则 null。这只是柱的集合一致性，不是出生信号或解释可信度。
- 上限为 **32 个去重变体**。第 33 个变体、任一必要分段失败、历法转换失败、节气表缺项或分段内部不一致，均返回 `status=sensitivity_unavailable`，原因分别为 `variant_limit_exceeded` 或 `calendar_or_segment_failed`。`segments/variants=[]`、`stablePillars=null`、`coverageComplete=false`，不保留截断集合。
- invalid_input / unavailable / sensitivity_unavailable 都有显式枚举错误码；失败输出同样有 strict Schema，不输出异常原文或用户资料。

## Unknown 的保障

unknown 覆盖 `[当日00:00:00,次日00:00:00)`，次日午夜不属于该出生日期。仍检查全天时支／日界规则和秒级节气切点；所有计算调用 `timeKnown=false`。

所有公开 chart 的 `pillars.hour/hourBranch` 始终 null，`knownPillars` 只有 year/month/day，五行计数只统计三柱。不把完整时柱生成后交给模型选择。库内部用于日序计算的 noon 不作为输入或输出事实。

回归证明：2025-02-03 立春 22:10:28 前后，unknown 保留甲辰/丁丑与乙巳/戊寅两个部分盘，`stablePillars.year/month/hour=null`；旧 unknown/noon 盘只能得到前一组，不能覆盖这两个候选。普通日期去重为一个部分盘，是检查所有分段后的结论。

## 边界测试覆盖

覆盖本轮要求的全部类别：普通 exact、同一时辰、跨时辰、14:50–15:10、闭端点15:00、22:50–次日00:10、同子时跨午夜、24小时闭区间、普通 unknown、unknown 节气日、同一时辰内的立春秒级变化、公农历等价、闰月及闰月末跨日。

另覆盖：海外/口径不明/历史口径、清空时间与 noon 绕过、用户自称已换算、非法 offset、超长范围、非法日期和闰月、变体去重、多段引用、整年12个换月节气日、全天 unknown 不产生时柱、缺分段／重叠／伪稳定／错误引用拒绝、32/33 上限、单段失败、历法失败、节气表缺失、不修改冻结输入、重复运行和输入键序变化完全一致、禁止 Date.now/Math.random/fetch、跨主机时区测试。

32/33 测试使用显式 synthetic 历法适配替身验证防御上限；不宣称真实 24 小时输入会产生 33 个不同四柱。其余历法边界使用当前库的确定性数据，没有 AI 调用。

## 验证结果

修改前基线：完整 `npm test` 为 **563 passed / 4 failed（83 files）**；基线 typecheck、lint 均通过。

| 命令 | 本次结果 |
| --- | --- |
| `npm test -- lib/bazi` | **101/101 passed，4 files**；含新增87项、原 chart 12项、Phase 1 signal schema 2项 |
| `TZ=America/New_York npm test -- lib/bazi` | **101/101 passed** |
| `npm test` | **650 passed / 4 failed，84 passed files / 1 failed file** |
| `npx tsc --noEmit` | 通过，exit 0 |
| `npm run lint` | 通过，exit 0 |
| `npm run build` | 通过，exit 0；18个静态页面构建完成，无部署 |
| `git diff --check` | 通过 |

原 chart 测试文件没有改动，12项均通过。完整测试仍失败的4项与基线名称及断言位置一致，全部位于 `lib/gemini/prompt.test.ts`：

1. carries the advisor role and its no-flattery principles
2. guides the model through the seven-section decision framework in order
3. requires chart-grounded JSON output with the fixed disclaimer
4. keeps the traditional terminology the product now asks for

这些是 pre-existing failures，未修复无关 Prompt 或测试。此次没有新增测试失败。Vite 配置产生的已有未来兼容性 warning 也未改动。

## 生产边界与剩余风险

没有新增 AI/LLM/Gemini 调用、AI1 generator、Prompt、UI、API 接线、Supabase/SQL、后台任务、SSE、capability、DeepFlowState、职业 pipeline、支付或验证器改动；没有部署。新入口只被本模块和 unit tests 引用，旧排盘只做共用计算函数提取。

剩余风险：输入真实性仍依赖用户准确声明，代码无法验证出生记录或识别隐瞒海外/误记日期；历史范围策略有意过度排除部分可解释日期；海外及其他当地钟表口径仍不转换；“下午”必须让用户确认具体范围；exact 仅表示用户声明及现有分钟粒度，不是记录真实性保证。库边界精度和流派规则沿用现状，需要在升级时重新验证。日期空间小，chart/segment hash 是稳定身份而非匿名化、签名或访问授权，本阶段没有持久化。

Implementation Phase 2A complete.

停止于确定性底层模块；不开始 Gemini AI1。
