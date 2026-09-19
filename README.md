# 八字分析 MVP

这是一个以中国标准时间计算农历日期、生成八字命盘，并通过 Google 官方 Gemini API（默认模型 `gemini-3.1-pro-preview`）输出结构化解读的 Next.js 应用。

## 本地开发

需要 Node.js 和 npm。安装依赖并复制服务端环境变量模板：

```bash
npm install
cp .env.example .env.local
npm run dev
```

在浏览器打开 <http://localhost:3000>。

### 环境变量

在 `.env.local` 中填写：

```dotenv
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=
GEMINI_REASONING_EFFORT=high
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
```

`GEMINI_API_KEY` 填 Google AI Studio 的 key（`AIza` 开头），模型默认
`gemini-3.1-pro-preview`，思考档位通过官方 `thinking_level` 传递。`GEMINI_MODEL` 可选，
用于覆盖默认模型；`GEMINI_REASONING_EFFORT` 可选，取值 `low` / `medium` / `high`，默认 `high`。
这些变量只由服务端读取，绝不能以 `NEXT_PUBLIC_` 前缀暴露，也不要提交 `.env.local`。

### Supabase 反馈表

创建 Supabase 项目后，在 Supabase SQL Editor 中执行仓库里的
[`supabase/feedback.sql`](supabase/feedback.sql)。它会创建 `public.feedback` 表并启用 RLS。

反馈接口仅写入 `rating`、`wants_deep_analysis` 和数据库自动生成的时间/id；没有公开的
RLS 插入策略，写入使用服务端 `SUPABASE_SERVICE_ROLE_KEY` 完成。若未配置
`SUPABASE_URL` 或 `SUPABASE_SERVICE_ROLE_KEY`，反馈会被禁用并返回配置提示，但八字分析仍可用。

## Vercel 部署

将项目导入 Vercel 后，在 Project Settings → Environment Variables 中为需要的环境
（Production，及希望使用的 Preview/Development）设置以下变量，然后重新部署：

| 变量 | 必需 | 值 |
| --- | --- | --- |
| `GEMINI_API_KEY` | 是 | Google AI Studio API key（仅服务端） |
| `GEMINI_MODEL` | 否 | 覆盖默认模型（默认 `gemini-3.1-pro-preview`） |
| `GEMINI_REASONING_EFFORT` | 否 | `low` / `medium` / `high`（默认 `high`） |
| `SUPABASE_URL` | 否 | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 否 | Supabase service-role key，仅服务端 |

不要把 service-role key 放进浏览器代码、公开日志、截图或 Git。Vercel 环境变量修改后须
重新部署才会进入运行中的函数。没有 Supabase 变量时仅关闭反馈，不会关闭分析；没有有效
API key 时分析接口会暂时不可用。

若使用 CLI：

```bash
vercel               # 首次运行时关联 Vercel 项目
vercel env add GEMINI_API_KEY production
vercel env add GEMINI_MODEL production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel --prod
```

## 隐私约束

- 出生日期、出生时分、四柱和报告内容只用于当前分析，不写入 cookie、localStorage、Supabase、分析日志或 URL。
- 报告只保存在当前页面内存中；刷新页面后需要重新分析。
- Supabase 只接收用户主动提交的 1–5 分评分和是否愿意继续深度分析，不接收出生信息或报告。
- 解读仅供参考，不构成医疗、法律或金融建议。

## 验证

```bash
npm run test
npm run lint
npm run build
```
