# Jianvia 个人探索报告

这是一个帮助用户探索性格倾向、优势特征、工作方式与环境偏好的 Next.js MVP。用户先用出生信息生成免费基础报告，再通过唯一的「职业现实校准」流程收敛 3–5 个值得验证的职业假设。

出生信息的确定性计算在服务端完成，基础报告采用传统命理术语解释盘面，专项报告保留现实校准与探索式建议。网站视觉继续采用简洁的移动端网页设计。AI 由 Google 官方 Gemini API 提供，默认模型为 `gemini-3.1-pro-preview`。

## 当前用户路径

1. 填写出生日期、时间与可选出生地区。
2. 获得免费基础探索报告并可提交极简反馈。
3. 点击“开始深入探索”，进入独立的 `/explore` 页面，完成职业现实校准：当前状态、收入底线、现实责任、地点边界、转型投入、职业资本、工作边界与当前优先级。
4. 确认现实条件摘要后进入支付；摘要确认前不会搜索招聘信息。
5. 支付确认后才检索招聘市场证据，并按「基础倾向 → 现实约束 → 职业资本 → 市场证据」收敛候选方向。
6. 生成完成后进入 `/deep-report`，查看现实边界、可迁移资本、3–5 个职业假设及未来 30 天验证计划。

## 本地开发

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 <http://localhost:3000>。

## 环境变量

```dotenv
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-3.1-pro-preview
GEMINI_REASONING_EFFORT=high
REPORT_PROVIDER=gemini
DEEP_REPORT_PRICE=¥29.90
DEEP_REPORT_AMOUNT=29.90
PAYMENT_PROVIDER=mock
PAYMENT_RECEIPT_SECRET=replace-with-a-long-random-secret
MOCK_PAYMENT_SECRET=replace-with-a-long-random-secret
MOCK_PAYMENT_OUTCOME=success
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key

# 仅支付宝沙箱模式需要
APP_URL=https://your-public-preview.example.com
ALIPAY_APP_ID=your-sandbox-app-id
ALIPAY_SELLER_ID=your-sandbox-seller-id
ALIPAY_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
ALIPAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
ALIPAY_KEY_TYPE=PKCS8
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
ALIPAY_NOTIFY_URL=https://your-public-preview.example.com/api/deep-analysis/payment/notify
ALIPAY_RETURN_URL=https://your-public-preview.example.com/explore
```

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `GEMINI_API_KEY` | 是 | Google AI Studio API key，仅服务端 |
| `GEMINI_MODEL` | 否 | 默认 `gemini-3.1-pro-preview` |
| `GEMINI_REASONING_EFFORT` | 否 | `low` / `medium` / `high`，默认 `high` |
| `REPORT_PROVIDER` | 否 | `gemini`（默认）或 `sample` |
| `DEEP_REPORT_PRICE` | 是 | 付费页价格，当前 `¥29.90` |
| `DEEP_REPORT_AMOUNT` | 支付宝时是 | 服务端签名金额，如 `29.90`，不含货币符号 |
| `PAYMENT_PROVIDER` | 否 | `mock` / `alipay_sandbox` / `alipay`，默认 `mock` |
| `PAYMENT_RECEIPT_SECRET` | 支付宝时是 | 支付确认后的内部报告凭证签名密钥 |
| `MOCK_PAYMENT_SECRET` | 是 | Mock 支付凭证 HMAC 签名密钥 |
| `MOCK_PAYMENT_OUTCOME` | 否 | `success` 或 `failure`，用于测试支付失败 |
| `SUPABASE_URL` | 否 | 反馈与会话里程碑持久化 |
| `SUPABASE_SERVICE_ROLE_KEY` | 否 | 仅服务端使用 |
| `APP_URL` | 支付宝时是 | 异步通知可被支付宝访问的公网 HTTPS 根地址 |
| `ALIPAY_*` | 支付宝时是 | App ID、卖家 ID、应用私钥、支付宝公钥、网关及回调地址；`alipay` 模式需换成正式应用的正式密钥 |

不要给密钥加 `NEXT_PUBLIC_` 前缀。Vercel 修改变量后需重新部署。

## 报告内容来源

`REPORT_PROVIDER=sample` 时，基础报告与职业专项报告全部由本地固定内容生成，不发出任何 Gemini 请求或招聘搜索，适合反复调试界面与流程。在 `.env.development.local` 里写入 `REPORT_PROVIDER=sample` 即可启用，生产环境保持 `REPORT_PROVIDER=gemini`。

所有启用中的模型调用都收在 `lib/report-provider` 这一层。基础报告与职业专项报告相互隔离：基础报告只由出生信息生成；职业专项只读继承已签名的基础报告，再做现实筛选，不能反向改写基础判断。

职业专项提示词在 `lib/deep-analysis/prompts/career.ts`。它固定按基础倾向、现实约束、职业资本、市场证据和价值排序组织输入；不把问卷答案重新包装成判断依据，也不把职业假设写成唯一答案或录用保证。

基础报告提示词在 `lib/gemini/prompt.ts`，固定请求句保持原样。提示词按「角色设定 → 核心目标 → 核心原则 → 输出框架」组织，要求以命理顾问视角把日主、十神、刑冲、用神翻译成现代商业与心理语言，按五节输出：核心矛盾、方位与环境、行业、协作和建议。行业、城市与搭档建议都要落到具体交集与产业气质，未知时柱不补造，传统解释不作为科学事实或结果承诺。可见文字目标 1000–1400 字，这是模型写作约束，服务端不截断或因篇幅自动重试。正文支持 `**加粗**` 重点标记，页面直接显示正文，不再显示报告目录。提示词更新只影响新生成的报告，当前标签页已保存的报告不会自动改写。

## 职业方向与招聘来源

正式生成职业专项报告时，后台在摘要确认和支付成功后，通过 Gemini 的 Google Search 工具检索招聘实例，再把通过白名单校验的证据交给报告模型。目标是形成 3–5 个可搜索、可验证的职业假设；证据不足时明确显示「市场可行性待验证」，不编造来源。

- 沿用 `GEMINI_API_KEY` 和 `GEMINI_MODEL`，无需新的搜索密钥；模型与账号需支持 Google Search grounding。检索是额外一次模型调用，可能产生搜索和模型用量费用。
- 搜索只接收从已确认校准结果生成的安全标签，不接收出生信息、基础报告正文或用户自由输入原文。
- 报告模型接收签名基础报告、规范化职业校准和已核验市场证据；招聘资料没有说明的学历、差旅或工时条件不会从岗位名称擅自推断。
- 来源从 API 的 grounding metadata 获取；仅接受已执行搜索、有引用对应文本、且指向支持的招聘网站职位详情页的来源。Google 引用跳转仅在白名单范围内解析，不跟随任意 URL。
- 最终职位名必须出现在对应引用文本中。来源 URL 和查询时间由服务端加入；无来源、重复、过期或无法核对的项会被丢弃。少于三项时明确说明，不强行补齐；搜索超时或不可用时保留方向报告，并显示来源缺失状态。
- 查询日期不是职位发布时间；搜索索引可能滞后，不保证仍可投递。报告展示 Google 返回的搜索建议（隔离 iframe）及招聘实例链接，用户应在招聘页面确认状态。
- `REPORT_PROVIDER=sample` 不检索、不调用 Gemini、不伪造招聘实例。
- 检索指令和来源白名单在 `lib/deep-analysis/research/jobs.ts`，职业分析管线在 `lib/deep-analysis/career-pipeline.ts`。

旧的工作 / 行业 / 城市 / 共事 / 自定义入口和生成 API 已关闭，不能通过旧 URL 发起生成。历史报告仅保留只读展示兼容；重新探索统一进入职业现实校准。

## 支付边界

`PAYMENT_PROVIDER=mock` 保留本地快速测试。`PAYMENT_PROVIDER=alipay_sandbox` 使用支付宝手机网站支付：服务端创建订单，跳转沙箱收银台，异步回调验签并校验 App ID、卖家 ID、订单号、金额和交易状态后，才签发绑定 Session 和方向的短期报告凭证。支付宝 `return_url` 只用于返回页面，不作为付款成功依据。

支付宝的异步通知无法访问 `localhost`，因此本地联调时 `APP_URL` 必须是指向当前本地服务的临时 HTTPS 隧道或 Vercel Preview 地址；浏览器回跳地址会自动使用发起支付的那个站点，不再单独依赖 `APP_URL`。

## Supabase

在 SQL Editor 中执行 `supabase/feedback.sql`、`supabase/deep-report-sessions.sql` 和 `supabase/payment-orders.sql`。三张表均启用 RLS，浏览器没有直接写权限。支付订单仅保存随机 Session ID、方向、金额和交易状态，不保存原始出生信息。支付宝模式下 Supabase 是必需的，以便在跨请求的异步回调中安全确认订单。

## 隐私与恢复

- 原始出生信息不写入 Supabase、Cookie、localStorage、URL 或应用日志。
- 当前标签页使用版本化 `sessionStorage` 保留基础报告快照、职业答题进度、摘要确认状态、支付状态与已生成报告；刷新可恢复，关闭标签页后由浏览器清理。
- 专项答题与深度报告分别使用固定路径 `/explore` 和 `/deep-report`，不将出生信息或报告内容放入 URL。
- 会话数据损坏或版本不兼容时安全丢弃。
- 报告不构成医疗、法律、金融或心理诊断建议。

## Vercel 部署

配置上述环境变量后重新部署。`vercel.json` 将 Functions 区域固定为东京 `hnd1`。深度报告 Route Handler 的 `maxDuration` 为 300 秒；若当前套餐不支持，部署验收应失败，不降低模型质量。

## 验证

```bash
npm test
npm run lint
npm run build
```

自动化覆盖免费基础报告、职业现实校准、摘要确认、支付边界、市场证据校验与职业专项报告展示。
