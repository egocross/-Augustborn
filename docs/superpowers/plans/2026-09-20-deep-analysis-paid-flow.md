# Deep Analysis Paid Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing free exploration report with a mobile-first paid deep-analysis funnel covering fixed calibration questions, custom questions, Mock Payment, structured Gemini reports, recovery, and optional Supabase persistence.

**Architecture:** Keep the current `/api/analyze` free-report path unchanged and mount a separate `DeepAnalysisFlow` after the existing feedback form. The deep flow is a reducer-backed client state machine persisted only in `sessionStorage`; server routes validate every transition, issue an HMAC-signed Mock Payment receipt, call Gemini through one server-only adapter, and optionally persist minimal structured milestones to Supabase.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod 4, Vitest, Testing Library, official `@google/genai`, Web Crypto/Node Crypto, Supabase service-role client, SSE.

**Spec:** `docs/superpowers/specs/2026-09-20-deep-analysis-paid-flow-design.md`

## Global Constraints

- Preserve the current free analysis API, report schema, report renderer, feedback flow, and modern visual direction.
- Do not expose traditional metaphysics vocabulary or symbols in any new user-facing copy.
- A/B/C/D contain exactly five deterministic questions; AI must never rewrite them.
- Custom questions may return either zero questions or three to five short necessary questions.
- Price comes from server-only `DEEP_REPORT_PRICE`, with production value `¥29.90`.
- Mock Payment is replaceable behind a service interface and must issue an HMAC-signed, expiring receipt.
- Gemini remains `gemini-3.1-pro-preview`; `GEMINI_REASONING_EFFORT` remains configurable and must not be silently lowered.
- The browser never calls Gemini or Supabase directly.
- Raw birth date, birth time, and birth region must not be stored in Supabase, localStorage, cookies, or URLs.
- Session recovery uses versioned `sessionStorage`; invalid or incompatible data is discarded safely.
- Deep report generation uses SSE, 15-second heartbeat, 240-second upstream deadline, 255-second client deadline, and `maxDuration = 300`.
- A Supabase outage must not block payment simulation or report delivery.
- New controls must be keyboard accessible, mobile-first at 375/390/430px, and honor `prefers-reduced-motion`.

## Review Focus

- Corrupt or old session payloads restore to a safe direction-selection state without affecting the free report; Task 6 tests this.
- A receipt for one direction cannot authorize a report for another direction, and expired/tampered receipts fail closed; Task 3 tests this.
- Multi-select limits cannot be bypassed through direct API requests or stale client state; Tasks 1 and 5 test this.
- Malformed Gemini JSON never renders partial unsafe UI and remains retryable without losing answers; Tasks 4, 5, and 7 test this.
- Supabase missing/rejected writes do not turn a successfully generated report into an error; Task 5 tests this.

---

## File Structure

New domain files live together under `lib/deep-analysis/`:

- `types.ts`: Zod schemas and inferred types shared by UI and API routes.
- `questions.ts`: immutable V1 fixed question bank and direction metadata.
- `answers.ts`: deterministic answer validation and completeness helpers.
- `summaries.ts`: privacy-safe birth/chart and free-report summaries.
- `payment.ts`: replaceable Mock Payment interface and signed receipt functions.
- `session.ts`: versioned browser-session serialization and reducer state helpers.
- `prompts/base.ts`: shared constraints and structured-output instructions.
- `prompts/{work,industry,city,collaboration,custom}.ts`: direction-specific prompt builders.
- `prompts/index.ts`: direction-to-prompt dispatch.
- `gemini.ts`: official Gemini adapter for custom questions and streamed reports.
- `persistence.ts`: optional server-only Supabase milestone writes.
- `stream.ts`: deep-analysis SSE event types and browser parser.

New API routes live under `app/api/deep-analysis/`; new UI lives in focused components under `components/deep-analysis/`.

---

### Task 1: Domain schemas, direction metadata, and fixed question bank

**Files:**
- Create: `lib/deep-analysis/types.ts`
- Create: `lib/deep-analysis/questions.ts`
- Create: `lib/deep-analysis/answers.ts`
- Test: `lib/deep-analysis/questions.test.ts`
- Test: `lib/deep-analysis/answers.test.ts`

**Interfaces:**
- Produces: `DirectionIdSchema`, `AnswerValueSchema`, `DeepAnswersSchema`, `DeepReportSchema`, `DynamicQuestionSchema`, `DIRECTIONS`, `QUESTION_BANK_V1`, `validateDirectionAnswers(directionId, answers)`, and `isDirectionComplete(directionId, answers)`.
- Consumes: no new interfaces.

- [ ] **Step 1: Write failing schema and question-bank tests**

```ts
it.each(['work', 'industry', 'city', 'collaboration'] as const)('%s has exactly five stable questions', (id) => {
  expect(QUESTION_BANK_V1[id]).toHaveLength(5);
  expect(new Set(QUESTION_BANK_V1[id].map((question) => question.id)).size).toBe(5);
});

it('rejects more than the configured multi-select limit', () => {
  const result = validateDirectionAnswers('work', { work_avoid: ['repeat', 'social', 'alone', 'managed'] });
  expect(result.success).toBe(false);
});
```

- [ ] **Step 2: Run the new tests and verify RED**

Run: `npm test -- lib/deep-analysis/questions.test.ts lib/deep-analysis/answers.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement schemas and the exact V1 question bank from the spec**

Use stable IDs and this common shape:

```ts
export const FixedQuestionSchema = z.object({
  id: z.string().min(1),
  directionId: z.enum(['work', 'industry', 'city', 'collaboration']),
  type: z.enum(['single', 'multi', 'text']),
  text: z.string().min(1),
  options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  required: z.boolean(),
  maxSelect: z.number().int().positive().optional(),
});
```

`validateDirectionAnswers` must reject unknown question IDs, unknown option IDs, missing required answers, wrong scalar/array shapes, and selections beyond `maxSelect`.

- [ ] **Step 4: Run focused and full tests**

Run: `npm test -- lib/deep-analysis/questions.test.ts lib/deep-analysis/answers.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all existing and new tests PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add lib/deep-analysis/types.ts lib/deep-analysis/questions.ts lib/deep-analysis/answers.ts lib/deep-analysis/questions.test.ts lib/deep-analysis/answers.test.ts
git commit -m "feat: add deep analysis question domain"
```

---

### Task 2: Privacy-safe summaries and direction prompt modules

**Files:**
- Create: `lib/deep-analysis/summaries.ts`
- Create: `lib/deep-analysis/prompts/base.ts`
- Create: `lib/deep-analysis/prompts/work.ts`
- Create: `lib/deep-analysis/prompts/industry.ts`
- Create: `lib/deep-analysis/prompts/city.ts`
- Create: `lib/deep-analysis/prompts/collaboration.ts`
- Create: `lib/deep-analysis/prompts/custom.ts`
- Create: `lib/deep-analysis/prompts/index.ts`
- Test: `lib/deep-analysis/summaries.test.ts`
- Test: `lib/deep-analysis/prompts/index.test.ts`

**Interfaces:**
- Consumes: `DirectionId`, `DeepAnswers`, `DeepReport` from Task 1; existing `Report`, `BaziChart`, and validated birth input.
- Produces: `createBirthSummary(input, chart)`, `createFreeReportSummary(report)`, and `createDeepPrompt(payload)`.

- [ ] **Step 1: Write failing summary and prompt tests**

```ts
it('does not include raw birth fields in the persistable summary', () => {
  const summary = createBirthSummary(input, chart);
  expect(JSON.stringify(summary)).not.toContain(input.birthDate);
  expect(JSON.stringify(summary)).not.toContain(input.birthTime!);
  expect(JSON.stringify(summary)).not.toContain(input.birthRegion);
});

it.each(['work', 'industry', 'city', 'collaboration', 'custom'] as const)('builds a distinct %s prompt', (directionId) => {
  const prompt = createDeepPrompt({ ...payload, directionId });
  expect(prompt).toContain('探索式');
  expect(prompt).toContain(directionId);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- lib/deep-analysis/summaries.test.ts lib/deep-analysis/prompts/index.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement deterministic summaries**

`createBirthSummary` returns only derived labels and chart structure required for inference; `createFreeReportSummary` returns section headings plus bounded section summaries and never calls AI.

- [ ] **Step 4: Implement shared and direction-specific prompts**

Every prompt must require the Task 1 `DeepReportSchema` shape, modern exploratory language, explicit evidence-to-recommendation links, uncertainty boundaries, mismatch conditions, validation experiments, and actionable next steps. The custom prompt must answer the user question rather than force it into a standard direction.

- [ ] **Step 5: Run focused and full tests, then commit**

Run: `npm test -- lib/deep-analysis/summaries.test.ts lib/deep-analysis/prompts/index.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

```bash
git add lib/deep-analysis/summaries.ts lib/deep-analysis/prompts lib/deep-analysis/summaries.test.ts lib/deep-analysis/prompts/index.test.ts
git commit -m "feat: add deep analysis summaries and prompts"
```

---

### Task 3: Replaceable Mock Payment and signed receipts

**Files:**
- Create: `lib/deep-analysis/payment.ts`
- Create: `lib/deep-analysis/payment.test.ts`
- Create: `app/api/deep-analysis/payment/route.ts`
- Test: `app/api/deep-analysis/payment/route.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `DirectionIdSchema` from Task 1.
- Produces: `PaymentService`, `mockPaymentService`, `issuePaymentReceipt(payload)`, `verifyPaymentReceipt(receipt, expected)`, and `POST /api/deep-analysis/payment` returning `{ status: 'paid', receipt, price }`.

- [ ] **Step 1: Write failing receipt tests**

```ts
it('rejects a valid receipt used for another direction', () => {
  const receipt = issuePaymentReceipt({ sessionId: 's1', directionId: 'work', paidAt: 1000 }, secret);
  expect(verifyPaymentReceipt(receipt, { sessionId: 's1', directionId: 'city', now: 1001 }, secret).success).toBe(false);
});

it('rejects tampered and expired receipts', () => {
  expect(verifyPaymentReceipt(`${receipt}x`, expected, secret).success).toBe(false);
  expect(verifyPaymentReceipt(receipt, { ...expected, now: paidAt + 31 * 60_000 }, secret).success).toBe(false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- lib/deep-analysis/payment.test.ts app/api/deep-analysis/payment/route.test.ts`

Expected: FAIL because payment code and route do not exist.

- [ ] **Step 3: Implement the service boundary and HMAC receipt**

The receipt payload is base64url JSON containing `version`, `sessionId`, `directionId`, `paidAt`, and `expiresAt`; sign it with `createHmac('sha256', MOCK_PAYMENT_SECRET)` and compare signatures with `timingSafeEqual`.

- [ ] **Step 4: Implement and test the payment route**

Validate body, read `DEEP_REPORT_PRICE`, call `mockPaymentService.pay`, return safe `payment_failed` on simulated failure, and never expose the signing secret.

- [ ] **Step 5: Run focused/full tests and commit**

Run: `npm test -- lib/deep-analysis/payment.test.ts app/api/deep-analysis/payment/route.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

```bash
git add lib/deep-analysis/payment.ts lib/deep-analysis/payment.test.ts app/api/deep-analysis/payment/route.ts app/api/deep-analysis/payment/route.test.ts .env.example
git commit -m "feat: add mock deep report payment"
```

---

### Task 4: Gemini adapter and custom follow-up question API

**Files:**
- Create: `lib/deep-analysis/gemini.ts`
- Create: `lib/deep-analysis/gemini.test.ts`
- Create: `app/api/deep-analysis/custom-questions/route.ts`
- Create: `app/api/deep-analysis/custom-questions/route.test.ts`

**Interfaces:**
- Consumes: official Gemini configuration, `DynamicQuestionSchema`, summary types from Task 2.
- Produces: `generateCustomQuestions(input, options?)`, `generateDeepReportStream(input, options?)`, and `POST /api/deep-analysis/custom-questions` returning `{ questions: [] | [3..5] }`.

- [ ] **Step 1: Write failing adapter and route tests**

```ts
it('accepts zero or three-to-five dynamic questions and rejects every other count', () => {
  expect(parseDynamicQuestions([])).toEqual([]);
  expect(() => parseDynamicQuestions([question])).toThrow();
  expect(parseDynamicQuestions([question, question2, question3])).toHaveLength(3);
});

it('returns parse_failed for malformed model output without echoing it', async () => {
  generateCustomQuestions.mockRejectedValue(new DeepAnalysisError('parse_failed'));
  const response = await POST(request);
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ code: 'parse_failed', error: expect.any(String) });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- lib/deep-analysis/gemini.test.ts app/api/deep-analysis/custom-questions/route.test.ts`

Expected: FAIL because adapter and route do not exist.

- [ ] **Step 3: Implement the server-only Gemini adapter**

Reuse `GEMINI_MODEL` and `GEMINI_REASONING_EFFORT`, inject an abort signal, use structured JSON schemas, map upstream/abort/parse failures to stable error codes, and do not log prompt or user text.

- [ ] **Step 4: Implement the custom-question route**

Validate the custom question length and summary object, enforce a 60-second abort deadline, and return only schema-validated short single/multi questions with stable `custom_q1` through `custom_q5` IDs.

- [ ] **Step 5: Run focused/full tests and commit**

Run: `npm test -- lib/deep-analysis/gemini.test.ts app/api/deep-analysis/custom-questions/route.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

```bash
git add lib/deep-analysis/gemini.ts lib/deep-analysis/gemini.test.ts app/api/deep-analysis/custom-questions/route.ts app/api/deep-analysis/custom-questions/route.test.ts
git commit -m "feat: add custom deep question generation"
```

---

### Task 5: Deep report SSE API and optional persistence

**Files:**
- Create: `lib/deep-analysis/persistence.ts`
- Create: `lib/deep-analysis/persistence.test.ts`
- Create: `lib/deep-analysis/stream.ts`
- Create: `lib/deep-analysis/stream.test.ts`
- Create: `app/api/deep-analysis/report/route.ts`
- Create: `app/api/deep-analysis/report/route.test.ts`
- Create: `supabase/deep-report-sessions.sql`

**Interfaces:**
- Consumes: answer validation, prompt payload, Gemini stream, receipt verification, existing Supabase admin client.
- Produces: `persistDeepSession(event)`, `consumeDeepReportStream(stream, callbacks)`, and `POST /api/deep-analysis/report` SSE events `status`, `heartbeat`, `delta`, `report`, and `error`.

- [ ] **Step 1: Write failing stream, persistence, and route tests**

```ts
it('rejects direct API answers above maxSelect before calling Gemini', async () => {
  const response = await POST(requestWithFourWorkAvoidances);
  expect(response.status).toBe(400);
  expect(generateDeepReportStream).not.toHaveBeenCalled();
});

it('delivers a valid report even when persistence rejects', async () => {
  persistDeepSession.mockRejectedValue(new Error('offline'));
  const events = await readEvents(await POST(validRequest));
  expect(events.at(-1)).toEqual({ type: 'report', report });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- lib/deep-analysis/persistence.test.ts lib/deep-analysis/stream.test.ts app/api/deep-analysis/report/route.test.ts`

Expected: FAIL because modules and route do not exist.

- [ ] **Step 3: Implement non-blocking persistence and SQL**

`persistDeepSession` must return `{ persisted: boolean }`, omit raw birth fields and full free-report prose, use service-role access only, and catch/log only safe operation metadata.

- [ ] **Step 4: Implement the validated SSE route**

Set `export const maxDuration = 300`; verify receipt/session/direction, validate answers, re-run the existing deterministic `createChart(birthInput)` on the server to build the privacy-safe summary, create a 240-second abort controller, emit a heartbeat every 15 seconds, parse the completed JSON through `DeepReportSchema`, and clear timers in `finally`. Raw birth input is used in-memory for this request and is never passed to persistence.

- [ ] **Step 5: Implement the client SSE consumer**

Parse fragmented SSE chunks, ignore heartbeat events, surface stable error codes, and return only a complete `DeepReport`.

- [ ] **Step 6: Run focused/full tests and commit**

Run: `npm test -- lib/deep-analysis/persistence.test.ts lib/deep-analysis/stream.test.ts app/api/deep-analysis/report/route.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

```bash
git add lib/deep-analysis/persistence.ts lib/deep-analysis/persistence.test.ts lib/deep-analysis/stream.ts lib/deep-analysis/stream.test.ts app/api/deep-analysis/report/route.ts app/api/deep-analysis/report/route.test.ts supabase/deep-report-sessions.sql
git commit -m "feat: add streamed deep report API"
```

---

### Task 6: Reducer, versioned session recovery, and questionnaire UI

**Files:**
- Create: `lib/deep-analysis/session.ts`
- Create: `lib/deep-analysis/session.test.ts`
- Create: `components/deep-analysis/direction-picker.tsx`
- Create: `components/deep-analysis/question-step.tsx`
- Create: `components/deep-analysis/question-step.test.tsx`
- Create: `components/deep-analysis/deep-analysis-flow.tsx`
- Create: `components/deep-analysis/deep-analysis-flow.test.tsx`

**Interfaces:**
- Consumes: direction metadata, fixed questions, dynamic question schema, payment/report endpoints.
- Produces: `deepFlowReducer`, `loadDeepSession`, `saveDeepSession`, `clearDeepSession`, and `<DeepAnalysisFlow birthInput freeReport />`.

- [ ] **Step 1: Write failing reducer/session recovery tests**

```ts
it('discards corrupt and incompatible session data', () => {
  storage.setItem(KEY, '{bad');
  expect(loadDeepSession(storage)).toBeNull();
  storage.setItem(KEY, JSON.stringify({ version: 0, state: {} }));
  expect(loadDeepSession(storage)).toBeNull();
});

it('preserves answers and paid receipt when generation fails', () => {
  const next = deepFlowReducer(paidState, { type: 'generationFailed', code: 'timeout' });
  expect(next.answers).toEqual(paidState.answers);
  expect(next.paymentReceipt).toBe(paidState.paymentReceipt);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- lib/deep-analysis/session.test.ts components/deep-analysis/question-step.test.tsx components/deep-analysis/deep-analysis-flow.test.tsx`

Expected: FAIL because session and components do not exist.

- [ ] **Step 3: Implement reducer and session storage**

Use `SESSION_VERSION = 1`, one namespaced key, schema validation on load, save after meaningful transitions, and clear only this feature's key. Store the receipt and report for retry/refresh, but never use localStorage, cookies, or URL state.

- [ ] **Step 4: Implement direction picker and one-question-at-a-time input**

Render option cards as real buttons/inputs, enforce selection limits in UI, show `第 N / 5 题`, preserve Back navigation, and use an accessible live region for errors and loading.

- [ ] **Step 5: Implement custom-question, optional-context, payment, and retry states**

The paid CTA is `生成我的深度报告`; payment begins only after all questions and the optional context screen. Failures remain on the recoverable step with all data intact.

- [ ] **Step 6: Run focused/full tests and commit**

Run: `npm test -- lib/deep-analysis/session.test.ts components/deep-analysis/question-step.test.tsx components/deep-analysis/deep-analysis-flow.test.tsx`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

```bash
git add lib/deep-analysis/session.ts lib/deep-analysis/session.test.ts components/deep-analysis
git commit -m "feat: add deep analysis questionnaire flow"
```

---

### Task 7: Structured report renderer, free-flow integration, and responsive styling

**Files:**
- Create: `components/deep-analysis/deep-report-view.tsx`
- Create: `components/deep-analysis/deep-report-view.test.tsx`
- Create: `components/deep-analysis/deep-generating-modal.tsx`
- Modify: `components/birth-form.tsx`
- Modify: `components/birth-form.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `<DeepAnalysisFlow>` and `DeepReport` from Tasks 1 and 6.
- Produces: expandable structured deep report UI mounted after the completed free report and feedback.

- [ ] **Step 1: Write failing renderer and integration tests**

```tsx
it('renders summary and expandable cards without a fixed chapter list', () => {
  render(<DeepReportView report={reportWithThreeModelSections} />);
  expect(screen.getByText(reportWithThreeModelSections.title)).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /展开阅读/ })).toHaveLength(3);
});

it('shows the deep-analysis entry only after the free report completes', async () => {
  render(<BirthForm />);
  expect(screen.queryByText('接下来，你最想进一步弄清楚什么？')).toBeNull();
  await generateFreeReport();
  expect(screen.getByText('接下来，你最想进一步弄清楚什么？')).toBeTruthy();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- components/deep-analysis/deep-report-view.test.tsx components/birth-form.test.tsx`

Expected: FAIL because renderer/integration do not exist.

- [ ] **Step 3: Implement structured renderer and waiting modal**

Render model-provided sections, summary, key points, evidence, risks, validation experiments, and next actions through generic data-driven cards. Details use accessible disclosure buttons; waiting state uses stage text and no percentage.

- [ ] **Step 4: Integrate after feedback and preserve reset behavior**

Pass the current in-memory birth input and completed free report into `DeepAnalysisFlow`. `重新分析` must clear both free and deep session state; free generation behavior remains unchanged.

- [ ] **Step 5: Add responsive, reduced-motion, and focus styling**

Use existing tokens and warm-gray canvas. Verify card spacing, 44px minimum controls, no horizontal overflow, visible focus rings, and reduced-motion fallbacks at 375/390/430px.

- [ ] **Step 6: Run focused/full tests and commit**

Run: `npm test -- components/deep-analysis/deep-report-view.test.tsx components/birth-form.test.tsx`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

```bash
git add components/deep-analysis/deep-report-view.tsx components/deep-analysis/deep-report-view.test.tsx components/deep-analysis/deep-generating-modal.tsx components/birth-form.tsx components/birth-form.test.tsx app/globals.css
git commit -m "feat: integrate responsive deep report experience"
```

---

### Task 8: End-to-end paths, documentation, build, and deployment readiness

**Files:**
- Create: `tests/deep-analysis-journeys.test.tsx`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `lib/deployment-config.test.ts`

**Interfaces:**
- Consumes: the complete flow from Tasks 1–7.
- Produces: three automated user-journey proofs, environment documentation, and deployment checks.

- [ ] **Step 1: Write failing journey tests for the required paths**

```ts
it('completes free report to work direction to paid deep report', async () => runJourney('work'));
it('completes free report to city direction to paid deep report', async () => runJourney('city'));
it('completes custom question through AI follow-ups to paid deep report', async () => runCustomJourney());
```

Each journey must assert direction selection, one-question navigation, optional context, payment CTA, generation stages, and final structured report.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/deep-analysis-journeys.test.tsx`

Expected: FAIL until all test fixtures and fetch-event sequences cover the full workflow.

- [ ] **Step 3: Complete journey fixtures and deployment configuration tests**

Add deterministic SSE fixtures for custom questions and deep reports. Assert `.env.example` documents `DEEP_REPORT_PRICE`, `MOCK_PAYMENT_SECRET`, and `MOCK_PAYMENT_OUTCOME`, and `vercel.json` keeps `hnd1`.

- [ ] **Step 4: Update README and run all quality gates**

Document the user path, Mock Payment replacement boundary, Supabase migration, privacy behavior, local setup, and retry behavior.

Run: `npm test`

Expected: all tests PASS.

Run: `npm run lint`

Expected: exit 0 with no ESLint errors.

Run: `npm run build`

Expected: exit 0 and all routes compile.

- [ ] **Step 5: Commit Task 8**

```bash
git add tests/deep-analysis-journeys.test.tsx README.md .env.example lib/deployment-config.test.ts
git commit -m "test: verify deep analysis paid journeys"
```

- [ ] **Step 6: Final whole-branch verification and production smoke test**

Run `npm test`, `npm run lint`, and `npm run build` once more from a clean working tree. After the fresh whole-branch review and any Important/Critical TDD fixes, push `codex/bazi-mvp`, deploy the current Vercel project, and verify `/`, `/api/deep-analysis/payment`, the work path, the city path, and the custom path on `https://www.jianvia.com/` without exposing secrets or persisting raw birth inputs.
