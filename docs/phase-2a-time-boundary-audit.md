# Phase 2A — Time Boundary Audit

审计日期：2026-10-07（Asia/Shanghai）。审计基线：`d65b757`（`codex/bazi-mvp`），开始时工作区干净。已逐段完整阅读 `integrated-advantage-report-v1.md`，检查最近八次提交，并阅读 `lib/bazi/*`、`lib/validation.ts`、相关 fixtures/tests、安装的 lunar-typescript 1.8.6 实现。本文第一轮结论在修改实现前记录；修复与验证结果在末尾追加。

## A. Blocking（修复前结论）

### B1 — 用出生年份封锁已声明标准时间的合法输入

- 问题／位置：`lib/bazi/input-v2.ts` 的 `historicalBasisUnverified`（基线 92–100 行）及 `assessBirthSupport`；`input-v2.test.ts` 的历史范围测试把错误政策固定成了预期。
- 当前逻辑：即使声明 `beijing_standard`，也拒绝公历 1950 年以前及 1986–1991 全年；跨日只比较年份。
- 影响：冬季、非夏令时日期以及本来就是固定 UTC+08 标准时间的记录被误判 unavailable。1950 既非库下限，也不是设计指定日期；该规则来自前轮实施者自行选择的保守范围。1986–1991 是一段真实实施过夏令时的年份，但绝不意味着六年每一天需要调整。
- 正确规则：选择用户允许的方案 E：Phase 2A 不推断或转换历史 civil time。`beijing_standard` 明确表示**输入日期和时间字段本身已经属于固定 UTC+08 标准钟表体系**，并非“人在北京”“出生证上的钟表时间”或“当时当地时间”。已知这一口径且未声明海外，1900–2100 合法日期均可处理；无法核实的历史钟表记录必须走 `historical_unverified`，一般不明口径走 `unverified`。绝不根据年份、地点、浏览器或当前 offset 猜测，也不静默减一小时。海外声明优先，标准时间声明不能覆盖它。
- 测试：旧封锁边缘日期、全部六年 DST 起止日及前后日期，分别测试标准口径 supported／历史口径不明 unavailable；覆盖 exact/range/unknown、公农历、闰月、跨午夜。保留“已换算”不能绕过海外测试。

### B2 — unknown 部分盘可被 schema 包装成 available

- 问题／位置：`lib/bazi/signal-schema.ts` 的 `BaziSignalSnapshotSchema` 非 unavailable 分支、`ChartVariantReferenceSchema`。
- 当前逻辑：拒绝 unknown 的 hour，但不要求 unknown 的 status 为 partial；knownPillars 允许仅一柱，未约束应有的年/月/日集合。
- 影响：虽然枚举器始终产生三柱 partial facts，下游消费契约仍允许把它表述为 available，或接受缺少日柱的所谓完整候选。一个部分盘内存在 stableSignals 不代表完整命盘。
- 正确规则：unknown 非 unavailable 必须 partial，且每个候选恰含年/月/日；已知时刻候选恰含四柱。时间置信、柱稳定性、出生分析状态是不同概念。
- 测试：由合法 synthetic snapshot 改造，重新计算 hash 后确认 available+unknown、缺日柱、已知时刻缺时柱均拒绝；合法 unknown partial 接受，hour 依赖继续拒绝。

### B3 — complete schema 只检查内部引用，未验证时间覆盖语义

- 问题／位置：`lib/bazi/time-variants.ts` 的 `CompleteChartVariantsSchema.superRefine`。
- 当前逻辑：检查相邻 segment、hash、stablePillars 的内部一致性；不检查 exact 是否单点、unknown 是否完整一天、confidence 是否与覆盖相符，也不复核 serialized segment 的历法事实。
- 影响：可以把 unknown 的全天结果截成上午，或把跨节气区间改成一段并重算公开 hash/ID，仍通过 complete 校验，形成伪稳定。现有 `enumerateChartVariants` 正常路径未发现产生此错误，但此 schema 是 Phase 2B 的可靠输入契约，不能只靠调用者诚实填写 `coverageComplete=true`。
- 正确规则：检查覆盖区间与 precision/confidence 语义；用冻结的历法规则验证 segment 起点、最后有效秒及内部所有必要边界的实际柱组合。hash 是内容标识，不是认证或完整性来源。schema 不证明用户记录真实性，也不能证明调用者没有谎报输入日期。
- 测试：重算 ID/hash 后的截短 unknown、宽范围伪 exact、伪 same-shichen、跨节气合并、错日 facts 必须拒绝；完整合法结果、同盘去重、合成 32/33 防御测试仍成立。

## B. Non-blocking

1. Legacy `createChart` 的 unknown 仍以 noon 决定单一年/月柱（`chart.ts`），在立春日不能用于新流程的稳定性判断。Phase 2A 入口没有调用它；旧 UI/API 未获本轮修改授权。保留反例测试，Phase 2B 只可消费完整枚举，不能复用 legacy 单盘。
2. 项目 23:00 时干与库 `EightChar.getTime()` **有已存在的区别**：项目用 sect=2 返回的当日日干自行派生时干；库 `_computeTime` 使用会在 23:00 推进的 dayGanIndexExact。例：2025-02-03 23:00，项目为癸卯日／壬子时，库 getTime 为甲子。沿用现有测试锁定的项目口径，不改流派；不能声称 setSect(2) 自动统一了库的全部日／时 API。
3. 库输出节气至整数秒，项目按该秒分段；这证明算法一致性，不是天文观测误差小于一秒。exact 的 HH:mm 沿用既有 HH:mm:00 点语义，不代表未知秒范围。未来若接入出生记录精度语义需独立版本。
4. 库依赖声明是 ^1.8.6，lock 与安装版本为 1.8.6，已有测试核对记录版本。升级必须重跑边界审计。没有新 dependency。
5. 真实记录是否已转换、是否隐瞒海外或误报口径无法由离线纯函数验证。本轮仅接受结构化明确声明；不把“北京时间”地名标签当验证，也不实施记录审核／海外转换器。
6. 全量测试有 4 个 pre-existing Prompt 失败（末尾列证据）。不修改生产 Prompt 或无关测试；全套尚未绿时不发布用户指定的最终通过声明。

## C. Verified（源码与独立检查）

- 时支：子为 [23:00,24:00) 与 [00:00,01:00)，其余每个奇数整点切换；00:59/01:00 到 22:59/23:00 均需验证。范围闭端点属于新状态，不与前段重复覆盖。
- 日界：当前 sect=2 日柱在 00:00 切换，23:00 保留当日。civil date 与日柱边界概念不同，在此规则下恰好同刻。endDayOffset 显式参与；23:10–次日00:10 虽同子时，日柱与项目时干仍变化。
- 节气：库年柱按立春实际时分秒、月柱按十二“节”时分秒。适配器选 `JIE_QI_IN_USE` 偶数项与库 `_computeMonth` 一致，跨年别名也在完整表中；不是24个气都切月。2025 立春为 02-03 22:10:28，同亥时内甲辰/丁丑→乙巳/戊寅。
- unknown：枚举 [00:00,次日00:00)，次日午夜不属于该日期；所有 canonical 调用 timeKnown=false，公开 hour/hourBranch=null，仅六个干支计数。虽有13个普通日 partial segments，未构造12个完整时柱盘。普通日去重成一个三柱盘，立春／换月日保留所有年/月组合。不投票、不赋概率。
- noon：新入口公农历转换用 00:00 字段；库 Lunar.fromYmdHms 内部 noon 只取目标年月日，随后恢复显式传入时分秒。库 `_computeDay` 内部 noon 用于日序计算，年/月另行读取真实时刻。均不把 noon 时柱灌入 unknown。
- segmentation：内部 [start,end)，最后用户闭端点为闭区间；结束恰逢边界时保留零长度闭单点。秒级极短段不舍弃。自然分段切点为时支、午夜、节气，含跨日与闰月转换后日期。
- dedupe：hash 包括全部四柱位（含null）、算法/库/sect/口径；这些唯一确定当前 canonical 的 hourBranch/timeKnown/表面五行。相同柱组合可共享 variant，保留全部 source segmentIds；不合并不同日柱、年/月或已知/未知时柱。未把未来尚未定义的藏干旺衰状态硬并入。
- 完整性：生产枚举先检查全部边界，计算每段起点与最后有效秒；任何失败丢弃全部候选。32 上限在去重后计算，第33项整体失败，绝不截断。真实≤24h 不能自然产生33盘，故上限测试明确使用 synthetic facts。
- confidence：派生只看输入 exact/range/unknown 及实际覆盖时支；approximate_same_shichen 不是整盘稳定，跨午夜与同一时辰跨节气仍多 variant。当前没有名为 ChartCertainty 的实现，也没有 AI stableSignals 生成器；stablePillars 仅为候选交集。
- 海外：raw 声明每次重评估；海外优先于标准时间声明，unknown／清空时间／noon／alreadyConverted／伪造 supported 都不绕过，年/月/日也不保留。无浏览器时区、当前 offset 或地理编码依赖。
- 公农历：负月表示闰月；日期换算与时分秒分开，随后在所得公历日期上枚举边界。输入农历年1900–2100可能转换到相邻公历年，库能计算；不把输入年的限制误作转换后日期截断。
- stableSignals 上游：只有 complete 的全部 canonical variants 才可成为后续出生分析输入；signal schema 只校验传入的候选引用集合，不能自行证明它等于原始时间范围。Phase 2B 未来必须由代码从完整枚举构建候选，不能由 AI 自报集合。本轮不实现生成器。

## 历史 civil time 与库的证据

技术来源：[IANA tzdb asia](https://data.iana.org/time-zones/tzdb/asia) 的 PRC／Shang／Asia/Shanghai 规则；[北京市政府1987年通知](https://www.beijing.gov.cn/zhengce/zfwj/zfwj/bgtwj/201905/t20190523_73193.html) 独立确认1987年起止日期、02→03和02→01；[国务院1990年通知](https://www.gov.cn/xxgk/pub/govpublic/mrlm/201012/t20101217_63240.html) 的检索摘要可核对1990年日期（正文抓取403）；1987/1992国务院公报PDF正文抓取不可用，不声称已直接阅读全文。

PRC规则对应起止日期（按1988年后4月/9月11日或之后首个星期日展开）：

| 年 | 开始（当地标准时02:00拨到03:00） | 结束（当地夏令时02:00拨回01:00） |
| --- | --- | --- |
| 1986 | 05-04 | 09-14 |
| 1987 | 04-12 | 09-13 |
| 1988 | 04-17 | 09-11 |
| 1989 | 04-16 | 09-17 |
| 1990 | 04-15 | 09-16 |
| 1991 | 04-14 | 09-15 |

全国政策不等于每个历史地点／个人记录都遵从同一钟表：tzdb 描述多种历史区域时间及新疆双时制，pre-1970 地方史也不完整；Shang 在1949-05-28结束，但没有“1950之前全不可计算”这条规则。不能把 Shanghai 历史表冒充全国每个出生记录的真值。保留这些事实用于说明口径风险，不将不完整历史表写成全国转换器。

DST 对普通夏令时记录的换算可改变时支；接近午夜时还可改变日期／日柱，接近节气可改变年/月柱；秋季重叠时刻更不能靠当前 offset 判定。unknown 的原始 civil date 也未必等于标准时间日期，不能仅删除时柱继续用其年/月/日。所有无法确认的日期＋时间口径整个出生通道 unavailable；已明确的固定标准时间无须再作历史调整。

安装库源码（`node_modules/lunar-typescript/dist/index.cjs`）：`Solar.fromYmdHms`直接构造字段；`Solar.fromDate`才读取主机Date字段，本项目不用；`Lunar.fromYmdHms`保留传入时间；`_computeYear/_computeMonth`用完整YmdHms比较；`EightChar.getDay`在sect=2用Exact2；`_computeTime`使用Exact；`ShouXingUtil.qiAccurate`加1/3日即固定8小时，并无历史DST查表。这些是安装1.8.6版本源码证据，不是假定库自动换算。[官方仓库](https://github.com/6tail/lunar-typescript)。

## 修复与验证记录

以下为修复前审计记录之后追加的实施与验证证据；工作始终限定在 Phase 2A。

### 修复结果（已完成）

| Blocking | 当前代码位置 | 修复 | 回归证据 |
| --- | --- | --- | --- |
| B1 | `lib/bazi/input-v2.ts:6,45,71,97` | 政策升为 birth-support-v2；移除年份推断；声明明确包含日期；拒绝与标准声明矛盾的 historical unavailable assessment | `time-boundary-audit.test.ts` 历史边缘15项、六年DST日期矩阵、夏季不擅自减小时、公农历/闰月；原 input-v2 历史测试改为明确历史口径不明 |
| B2 | `lib/bazi/signal-schema.ts:118,171` | 精确检查 knownPillars 集合；unknown 必须 partial | 3项重新封装hash的消费契约正反例 |
| B3 | `lib/bazi/time-variants.ts:53,108` | 验证覆盖长度、端点、时间置信；重核每段实际历法事实和内部必要边界 | 4项重新计算公开ID/hash后仍被拒绝的伪完整/伪稳定反例 |

本次只修改以上3个 Phase 2A 实现文件、相关测试及审计/实施说明。未改 chart 流派逻辑、validation legacy、Prompt、Gemini AI1、UI/API、Supabase、职业链路或任何部署内容。未提交或推送。

先写 `time-boundary-audit.test.ts`，旧实现运行 **27 failed / 26 passed**，失败为真实支持判定及 schema 拒绝断言；完成三个修复后同组全部通过，再补10项年份/秒边界/noon测试。最终新增63项测试，无为变绿而弱化历史、unknown或完整性预期。原先将整年封锁当正确规则的测试明确改为针对 `historical_unverified`，没有删除历史口径风险测试。

### 最终命令与结果

| 验证 | 结果 |
| --- | --- |
| 修改前 `npm test -- lib/bazi` | 101 passed，4 files |
| 新反例对旧实现 | 27 failed / 26 passed，证明 B1/B2/B3 |
| 修改后 `npm test -- lib/bazi` | **164 passed，5 files，exit 0** |
| `TZ=America/New_York npm test -- lib/bazi` | **164 passed，exit 0** |
| 修改前完整 `npm test` | 650 passed / 4 failed，85 files，exit 1 |
| 修改后完整 `npm test` | **713 passed / 4 failed，86 files，exit 1** |
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** |
| `npm run build` | **exit 0**，18个静态页面生成完成，无部署 |
| `git diff --check` | **exit 0** |

全量测试修改前后失败名称逐项一致，均为 `lib/gemini/prompt.test.ts`：

1. carries the advisor role and its no-flattery principles
2. guides the model through the seven-section decision framework in order
3. requires chart-grounded JSON output with the fixed disclaimer
4. keeps the traditional terminology the product now asks for

这些是 **pre-existing failures**，未改生产 Prompt，也未把失败测试跳过。Vite 的既有 configLoader 兼容性 warning 保留。日志在本机 `/tmp/bazi-phase2a-audit-{baseline,red,targeted,new-york,final-tests,tsc,lint,build}.log`，仅作本次运行记录。

### 要求的18类测试覆盖

| 项目 | 证据（均位于 lib/bazi） |
| --- | --- |
| 每个时辰±1分钟、精确边界 | `time-boundary-audit.test.ts` literal十二行；边界新状态及闭端点单点 |
| 同时辰跨节气 | `time-variants.test.ts` 22:10–22:11；audit exact second±1 |
| 跨午夜／civil date与日柱 | `time-variants.test.ts` 两组跨日；audit 22:59/23:00/23:59/00:00/00:59/01:00 literal柱值 |
| unknown普通日／节气日／立春 | 原13段去重、2025十二节；audit额外8个年份共96个节日、2023/2025 noon反例 |
| 农历／闰月 | 原普通转换、闰月末跨日、2025十二节公农历等价；audit闰月清明exact/range/unknown等价 |
| 海外unavailable | input-v2与time-variants中 exact/range/unknown、清空/noon/伪造声明/alreadyConverted，零排盘与零节气调用 |
| historical规则边缘 | audit 15边缘日期；1986–1991逐年起止日前/当日/后一天及01:59/02:00/02:59/03:00、跨午夜、unknown |
| dedupe | 原普通日13 segments→12完整variants且保留双子时来源；audit超过32段仍去重1盘 |
| incomplete failure | 原必要段中途失败、库转换失败、缺节气表、漏切点全量丢弃；audit拒绝截短coverage |
| >32 variants | 原32通过/33整体unavailable的synthetic边界，非截断 |
| noon污染反例 | 原2025晚间立春；audit2023上午立春，均保留两种年/月组合 |
| 重复确定性／immutability | 原深冻结输入、声明和原文不变；重复/键序一致；禁Date.now/随机/网络；纽约时区全组通过 |

### 最终出口

Phase 2A 范围内本次发现的 **3 个 Blocking 已全部修复，剩余0项**。时间边界、unknown、海外门禁及完整候选集合相关164项测试通过。历史政策有明确的输入语义与来源说明，不再封锁整年，也未引入历史转换器。

**完整 npm test 仍有4个既有失败，尚未满足用户要求的全部出口条件。因此本次不发布“审计通过、可进入 Phase 2B”的最终声明。** 停止于 Phase 2A；没有开始 Phase 2B。
