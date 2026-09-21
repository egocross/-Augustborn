# Jianvia 个人探索报告

这是一个帮助用户探索性格倾向、优势特征、工作方式与环境偏好的 Next.js MVP。用户先免费生成基础报告，再可选择职业、行业、城市、工作环境或自定义问题，完成现实校准后生成专项深度报告。

出生信息的确定性计算只在服务端内部完成，前端保持现代自我探索语言。AI 由 Google 官方 Gemini API 提供，默认模型为 `gemini-3.1-pro-preview`。

## 当前用户路径

1. 填写出生日期、时间与可选出生地区。
2. 获得免费基础探索报告并可提交极简反馈。
3. 选择职业、行业、城市、合作环境或自定义方向。
4. 标准方向回答固定 5 题；自定义问题由 AI 判断是否需要 3–5 个补充问题。
5. 填写可选现实补充，通过 Mock Payment 进入生成。
6. 生成完成后进入独立报告页，获得可展开阅读的结构化深度报告。

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
DEEP_REPORT_PRICE=¥29.90
MOCK_PAYMENT_SECRET=replace-with-a-long-random-secret
MOCK_PAYMENT_OUTCOME=success
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `GEMINI_API_KEY` | 是 | Google AI Studio API key，仅服务端 |
| `GEMINI_MODEL` | 否 | 默认 `gemini-3.1-pro-preview` |
| `GEMINI_REASONING_EFFORT` | 否 | `low` / `medium` / `high`，默认 `high` |
| `DEEP_REPORT_PRICE` | 是 | 付费页价格，当前 `¥29.90` |
| `MOCK_PAYMENT_SECRET` | 是 | Mock 支付凭证 HMAC 签名密钥 |
| `MOCK_PAYMENT_OUTCOME` | 否 | `success` 或 `failure`，用于测试支付失败 |
| `SUPABASE_URL` | 否 | 反馈与会话里程碑持久化 |
| `SUPABASE_SERVICE_ROLE_KEY` | 否 | 仅服务端使用 |

不要给密钥加 `NEXT_PUBLIC_` 前缀。Vercel 修改变量后需重新部署。

## Mock Payment 边界

`lib/deep-analysis/payment.ts` 的 `PaymentService` 是支付抽象边界。当前不会实际扣款，只签发绑定 Session 和方向、30 分钟有效的 HMAC 凭证。接入微信支付、支付宝或 Stripe 时替换该服务，保留 API 和 UI 状态机。

## Supabase

在 SQL Editor 中执行 `supabase/feedback.sql` 和 `supabase/deep-report-sessions.sql`。两张表均启用 RLS，浏览器没有直接写权限。深度会话只保存方向、稳定题目/选项 ID、可选补充、支付状态和结构化报告，不保存原始出生日期、时间或地区。Supabase 未配置或写入失败时不阻断报告交付。

## 隐私与恢复

- 原始出生信息不写入 Supabase、Cookie、localStorage、URL 或应用日志。
- 当前标签页使用版本化 `sessionStorage` 保留，刷新可恢复；关闭标签页后由浏览器清理。
- 深度报告使用固定路径 `/deep-report`，不将出生信息或报告内容放入 URL。
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

自动化覆盖免费报告到职业方向、城市方向和自定义问题的三条完整路径。
