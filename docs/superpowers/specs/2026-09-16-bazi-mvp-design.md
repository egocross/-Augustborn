# 八字分析 MVP 设计

## 目标与范围

交付一个可部署的单页输入、单页结果的八字分析产品。用户按中国标准时间输入农历生日和时间；服务端确定性计算四柱结构，并由 Gemini 3.1 Pro Preview（High）基于该结构生成报告。无登录、支付、历史记录或出生信息持久化。

## 用户流程

1. 用户在 `/` 选择农历年、月、日，填写 24 小时制时分；例如“1977 年九月初三，中午 1–2 点左右”填写为 `1977 / 九月 / 初三 / 13:30`，属于未时（13:00–14:59）。
2. 客户端仅在提交时将这组数据发送至 `/api/analyze`；请求完成后不写入数据库。
3. 路由调用纯排盘函数，得到四柱、天干地支、五行统计和用于报告的结构化上下文；再调用 Gemini 模块。
4. 结果页动态显示模型返回的 `title`、`summary` 与 `sections[]`，不依赖固定模块数或固定标题。
5. 用户可提交 1–5 分准确度，以及是否愿意继续深度分析。`/api/feedback` 只写入评分、意向与时间，不写入生日、时分、四柱或报告内容。

## 架构与边界

- `lib/bazi/`：无网络、无框架依赖的确定性排盘域模块。它接收农历日期、时分与固定时区 `Asia/Shanghai`，转为公历并按节气划分年柱与月柱，计算日柱、时柱和五行计数。
- `lib/gemini/`：唯一的模型供应商边界。`config.ts` 管理模型与思考等级，`prompt.ts` 管理报告约束，`generate-report.ts` 将排盘数据转换为 Gemini 请求并验证 JSON 响应。未来替换供应商只需改此目录。
- `app/api/analyze/route.ts`：输入校验、编排，不保存数据。
- `app/api/feedback/route.ts`：输入校验后写入 Supabase；当反馈环境变量未配置时返回可理解的配置错误。
- `app/page.tsx` 与 `app/result/page.tsx`：只处理表单、导航和呈现；报告渲染器根据模型 JSON 迭代 sections。

## 排盘规则

输入和所有计算均采用 `Asia/Shanghai`。农历日期转换为公历日期；四柱按传统节气而不是农历月份划分：年以立春切换，月以十二节令切换。日柱以儒略日序号的标准干支循环计算。时支由当地标准时的两小时段决定，13:00–14:59 为未时，时干由日干推导。MVP 不支持出生地真太阳时、夏令时修正或跨时区。

## Gemini 契约

模型固定默认 `gemini-3.1-pro-preview`，请求配置使用 `thinkingLevel: HIGH`。提示词要求只依据给定的排盘事实，避免确定性健康、法律、财务预测或恐吓式语言，并输出 JSON：

```json
{
  "title": "string",
  "summary": "string",
  "sections": [{ "heading": "string", "body": "string", "bullets": ["string"] }],
  "disclaimer": "string"
}
```

`sections` 长度与内容由模型决定；前端只验证该结构并循环渲染。模型失败时，API 不伪造报告，而是返回安全的暂时不可用错误。

## 数据与隐私

环境变量仅在服务端读取。Supabase 表 `feedback` 仅含 `id`、`rating`、`wants_deep_analysis`、`created_at`。表开启 RLS；插入由服务器的 service role key 完成。出生信息不会写 cookie、localStorage、数据库或日志；结果页导航状态只在内存中保留，刷新后显示重新分析入口。

## 失败处理与验证

表单阻止无效农历日期或时分；后端再次校验。缺少 Gemini 凭证、模型失败、模型返回无效 JSON、Supabase 未配置等场景显示明确错误。

测试覆盖农历/时辰规则、五行统计、模型响应解析和反馈校验。完成前运行单元测试、lint 和生产构建；部署前提供 `.env.example` 和 Supabase SQL。
