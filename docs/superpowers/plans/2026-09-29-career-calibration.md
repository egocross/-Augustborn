# Career Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five legacy exploration entry points with one mobile-first career reality-calibration flow that narrows the base report into 3–5 evidence-aware career hypotheses after payment.

**Architecture:** Reuse the existing `/explore`, payment receipt, SSE generation, session recovery, Supabase milestone, and `/deep-report` shells. Add a server-signed immutable handoff for each completed base report, a dedicated career questionnaire/configuration boundary, and normalized answers before the paid API call. Enforce `base tendencies → hard constraints → career capital → market evidence → convergence` on the server. Keep old completed reports readable through a legacy parser while rejecting every legacy questionnaire, direction, custom-question, payment, and generation request.

**Tech Stack:** Next.js 16.3.5 App Router, React 19.2.8, TypeScript 5, Zod 4.6.5, Vitest 4.1.11, Testing Library, Google Gemini + Google Search grounding, Supabase, existing mock/Alipay payment adapters.

**Spec:** `docs/superpowers/specs/2026-09-29-career-calibration-design.md`

## Global Constraints

- Career analysis inherits the completed base report in one direction only; no career answer or report may rewrite, regenerate, or feed back into the base report.
- Server analysis order is fixed: base tendencies → hard constraints → career capital → market evidence → converged directions.
- Recruitment search starts only after the summary is confirmed and the payment receipt is verified.
- Legacy work/industry/city/collaboration/custom entry points and write APIs must be unreachable; old completed reports remain read-only.
- Do not modify birth-input behavior, calendar conversion, chart calculation, the base-report prompt/schema/content-generation logic, or payment signing/callback/order-state core logic. The only permitted base-report plumbing change is an opaque server-signed handoff token attached after a valid report has already been generated.
- Preserve the user's uncommitted `lib/gemini/prompt.ts` byte-for-byte. Never stage it, format it, restore it, or include it in a task commit.
- Do not add a state-management dependency or speculative market-data infrastructure.
- Use `sessionStorage` for the unpaid draft; store only normalized submitted answers and completed report milestones in the existing Supabase session row.
- Mobile browser widths 375px, 390px, and 430px are first-class; all interactive targets are at least 44px.
- Market facts without validated sources are omitted or marked “市场可行性待验证”; never invent salary, counts, growth, qualifications, or trends.

## Review Focus

1. A hidden conditional answer left in restored storage must be removed before validation and must not leak into the prompt or database (Task 1 test).
2. A version-2 session with a completed report must open read-only, while a version-2 draft must not restore into a removed flow (Task 2 test).
3. A forged legacy direction/payment payload must fail before payment, search, or Gemini are called (Task 4 test).
4. A valid receipt with unavailable market search must still produce a report whose market state is explicitly unverified (Task 5 test).
5. A base report containing prompt-like text must remain inert data inside the ordered prompt sections and must never become instructions (Task 5 test).
6. A changed or forged base report must fail its signed snapshot check before payment-bound generation, research, or Gemini are called (Task 2 and Task 4 tests).

## Execution Prerequisite

Before changing App Router routes or client/server component boundaries, read the repository-bundled Next.js 16 documentation at:

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/02-guides/forms.md`
- `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`
- `node_modules/next/dist/docs/03-architecture/accessibility.md`

Use those docs as the source of truth for Next.js 16 behavior; do not rely on older App Router assumptions.

---

### Task 1: Career questionnaire configuration, branching, and normalization

**Files:**
- Create: `lib/deep-analysis/career-calibration.ts`
- Create: `lib/deep-analysis/career-calibration-questions.ts`
- Create: `lib/deep-analysis/career-calibration.test.ts`
- Create: `lib/deep-analysis/career-calibration-questions.test.ts`
- Modify: `lib/deep-analysis/answer-rules.ts`
- Modify: `lib/deep-analysis/answer-rules.test.ts`

**Interfaces:**
- Produces `CAREER_QUESTIONNAIRE_VERSION = 'career-v1'`, `CAREER_SECTIONS`, and `CAREER_QUESTIONS`.
- Produces `CareerQuestion`, `CareerDraftAnswers`, `CareerCalibration`, `CareerCalibrationSchema`, `getVisibleCareerQuestions(answers)`, `pruneHiddenCareerAnswers(answers)`, `validateCareerDraft(answers)`, `normalizeCareerCalibration(answers)`, and `summarizeCareerCalibration(calibration)`.
- Conditions are serializable data (`questionId`, operator, option IDs), not closures embedded in JSX.

- [ ] **Step 1: Write failing question-bank and branching tests**

Assert that the bank contains the eight approved sections and all required option labels; every ID is unique; values allow at most three selections; salary-runway, mobility-reason, and overseas-language questions appear only under their approved conditions; and changing a controlling answer prunes stale hidden answers.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npx vitest run lib/deep-analysis/career-calibration-questions.test.ts`

Expected: FAIL because the career questionnaire module does not exist.

- [ ] **Step 3: Implement the typed question configuration and visibility evaluator**

Use the exact question/option copy from the approved request. Keep long option lists in configuration, provide `other` metadata and 200-character bounds, and model exclusive placeholder options explicitly.

- [ ] **Step 4: Write failing normalization and summary tests**

Cover empty/unknown IDs, single/multi limits, custom minimum income, mutually exclusive options, hidden stale answers, all four reference cases, and an assertion that normalized data separates `hardConstraints`, `careerCapital`, and `values` rather than flattening them.

- [ ] **Step 5: Run the normalization tests and confirm RED**

Run: `npx vitest run lib/deep-analysis/career-calibration.test.ts lib/deep-analysis/answer-rules.test.ts`

Expected: FAIL because normalization and the new exclusivity metadata are absent.

- [ ] **Step 6: Implement schemas, validation, normalization, and summary generation**

`normalizeCareerCalibration` returns the explicit structure in the spec and rejects unknown, hidden, incomplete, or over-limit answers. `summarizeCareerCalibration` uses ranges and neutral language; it does not infer facts the user did not provide.

- [ ] **Step 7: Run Task 1 tests and commit**

Run: `npx vitest run lib/deep-analysis/career-calibration.test.ts lib/deep-analysis/career-calibration-questions.test.ts lib/deep-analysis/answer-rules.test.ts`

Expected: PASS.

Commit only Task 1 paths:

```bash
git add lib/deep-analysis/career-calibration.ts lib/deep-analysis/career-calibration-questions.ts lib/deep-analysis/career-calibration.test.ts lib/deep-analysis/career-calibration-questions.test.ts lib/deep-analysis/answer-rules.ts lib/deep-analysis/answer-rules.test.ts
git commit -m "feat: define career reality calibration"
```

### Task 2: Signed base-report handoff, career-only session state, and legacy-report migration

**Files:**
- Create: `lib/deep-analysis/base-report-snapshot.ts`
- Create: `lib/deep-analysis/base-report-snapshot.test.ts`
- Modify: `lib/analyze-stream.ts`
- Modify: `lib/analyze-stream.test.ts`
- Modify: `app/api/analyze/route.ts`
- Create: `app/api/analyze/route.test.ts`
- Modify: `components/birth-form.tsx`
- Modify: `components/birth-form.test.tsx`
- Modify: `components/deep-analysis/deep-analysis-entry.tsx`
- Modify: `components/deep-analysis/deep-analysis-entry.test.tsx`
- Modify: `lib/deep-analysis/session.ts`
- Modify: `lib/deep-analysis/session.test.ts`
- Modify: `lib/deep-analysis/types.ts`

**Interfaces:**
- Consumes `CareerDraftAnswers`, `CareerCalibration`, and `CAREER_QUESTIONNAIRE_VERSION` from Task 1.
- Produces career steps `intro | questions | summary | payment | generating | report`, section/question cursor state, `summaryConfirmed`, and payment/report recovery fields.
- Produces `issueBaseReportSnapshot(report)` and `verifyBaseReportSnapshot(report, token)` using a canonical report digest and server-side HMAC; the token authenticates the immutable report without embedding birth input or changing `ReportSchema`.
- The analyze SSE `report` event adds the opaque snapshot token only after `ReportSchema` parsing succeeds; the client stores it beside the completed report. This changes transport plumbing only, not the base prompt, report schema, chart, or generated content.
- Produces `createInitialCareerState(sessionId, { freeReport, baseReportSnapshotToken })`, updated reducer actions, and a loader that migrates only a completed legacy report to read-only state.
- Uses the internal payment direction constant `CAREER_DIRECTION_ID = 'work'`; it is never exposed as a user-selectable direction.

- [ ] **Step 1: Write failing signed-handoff tests**

Assert a valid generated report and token verify together; changing any heading/body/bullet/disclaimer fails verification; malformed and unsigned tokens fail closed; `app/api/analyze` emits the token only with a valid completed report; and the stream consumer/storage layer preserves it without changing `ReportSchema`.

- [ ] **Step 2: Run handoff tests and confirm RED**

Run: `npx vitest run lib/deep-analysis/base-report-snapshot.test.ts lib/analyze-stream.test.ts app/api/analyze/route.test.ts components/birth-form.test.tsx components/deep-analysis/deep-analysis-entry.test.tsx`

Expected: FAIL because no signed base-report handoff exists.

- [ ] **Step 3: Implement the minimal signed handoff**

Reuse an existing server secret with an explicit production failure when no signing secret is configured; allow a deterministic development/test fallback only outside production. Do not persist birth input, alter the model prompt, or change the report content schema.

- [ ] **Step 4: Write failing reducer and restoration tests**

Assert intro-to-question flow, visible-question navigation, answer retention when moving backward, summary confirmation, retry after interrupted generation, and that a fresh base report resets an unfinished calibration draft.

Add the Review Focus migration cases: a v2 completed report loads in `report` read-only mode; a v2 draft or legacy direction state returns `null`/fresh career state and cannot reopen a removed questionnaire.

- [ ] **Step 5: Run the session test and confirm RED**

Run: `npx vitest run lib/deep-analysis/session.test.ts`

Expected: FAIL because the state still contains direction/custom-question steps.

- [ ] **Step 6: Implement the career state machine and safe legacy migration**

Remove new-session direction selection and custom-question data. Bump the envelope version. Preserve only legacy `report`/`lastReport` objects that parse successfully; mark them read-only and omit any action that can create another legacy report.

- [ ] **Step 7: Run Task 2 tests and commit**

Run: `npx vitest run lib/deep-analysis/base-report-snapshot.test.ts lib/analyze-stream.test.ts app/api/analyze/route.test.ts components/birth-form.test.tsx components/deep-analysis/deep-analysis-entry.test.tsx lib/deep-analysis/session.test.ts`

Expected: PASS.

```bash
git add lib/deep-analysis/base-report-snapshot.ts lib/deep-analysis/base-report-snapshot.test.ts lib/analyze-stream.ts lib/analyze-stream.test.ts app/api/analyze/route.ts app/api/analyze/route.test.ts components/birth-form.tsx components/birth-form.test.tsx components/deep-analysis/deep-analysis-entry.tsx components/deep-analysis/deep-analysis-entry.test.tsx lib/deep-analysis/session.ts lib/deep-analysis/session.test.ts lib/deep-analysis/types.ts
git commit -m "feat: sign base report handoff and migrate career session"
```

### Task 3: Mobile career introduction, questionnaire, and summary UI

**Files:**
- Create: `components/deep-analysis/career-calibration-question.tsx`
- Create: `components/deep-analysis/career-calibration-question.test.tsx`
- Create: `components/deep-analysis/career-calibration-summary.tsx`
- Create: `components/deep-analysis/career-calibration-summary.test.tsx`
- Modify: `components/deep-analysis/deep-analysis-entry.tsx`
- Modify: `components/deep-analysis/deep-analysis-entry.test.tsx`
- Modify: `components/deep-analysis/deep-analysis-flow.tsx`
- Modify: `components/deep-analysis/deep-analysis-flow.test.tsx`
- Modify: `components/deep-analysis/deep-exploration-page.tsx`
- Modify: `components/deep-analysis/deep-exploration-page.test.tsx`
- Delete: `components/deep-analysis/direction-picker.tsx`
- Delete: `components/deep-analysis/question-step.tsx`
- Delete: `components/deep-analysis/question-step.test.tsx`

**Interfaces:**
- Consumes Task 1 question configuration and Task 2 reducer.
- `CareerCalibrationQuestion` renders single, multi, other-text, and custom-amount inputs with `fieldset/legend`, selected marks, `aria-live`, and exact validation errors.
- `CareerCalibrationSummary` renders `summarizeCareerCalibration(...)`, an edit action, and a confirm action.
- `DeepAnalysisEntry` accepts only the completed `freeReport` plus its opaque snapshot token, creates a career session, and routes to `/explore`.

- [ ] **Step 1: Write failing component tests for introduction and question UX**

Assert the base-report CTA says “开始职业专项分析”; `/explore` begins with the 2–4 minute career introduction; no legacy direction labels are present; stage progress uses labels instead of numeric question counts; multi-select limits and other/custom fields are keyboard accessible; selection is not communicated by color alone. A restored pre-upgrade base report without a snapshot token remains readable but cannot start a forged career flow; it shows a clear “请重新生成基础报告” recovery action.

- [ ] **Step 2: Run the component tests and confirm RED**

Run: `npx vitest run components/deep-analysis/career-calibration-question.test.tsx components/deep-analysis/deep-analysis-entry.test.tsx components/deep-analysis/deep-analysis-flow.test.tsx`

Expected: FAIL because the career UI does not exist and the legacy picker still renders.

- [ ] **Step 3: Implement introduction and one-decision-per-screen questionnaire**

Use the existing card/button tokens and question viewport. Keep the footer actions reachable in `100dvh`; long option content scrolls inside the panel. Single selection may advance only when no conditional/custom input is revealed; otherwise the user explicitly continues.

- [ ] **Step 4: Write failing summary and recovery tests**

Assert that completion opens the summary instead of payment, the summary reflects normalized ranges without adding facts, “返回修改” returns to the last visible question, confirmation marks the summary confirmed and opens payment, refresh restores the same visible step, and validation navigates to the first missing visible question.

- [ ] **Step 5: Run the summary tests and confirm RED**

Run: `npx vitest run components/deep-analysis/career-calibration-summary.test.tsx components/deep-analysis/deep-analysis-flow.test.tsx components/deep-analysis/deep-exploration-page.test.tsx`

Expected: FAIL because there is no summary step.

- [ ] **Step 6: Implement summary and remove all five legacy entry components**

Delete the picker/question components only after imports and tests are replaced. Keep old completed report rendering separate from the new questionnaire path.

- [ ] **Step 7: Run Task 3 tests and commit**

Run: `npx vitest run components/deep-analysis/career-calibration-question.test.tsx components/deep-analysis/career-calibration-summary.test.tsx components/deep-analysis/deep-analysis-entry.test.tsx components/deep-analysis/deep-analysis-flow.test.tsx components/deep-analysis/deep-exploration-page.test.tsx`

Expected: PASS.

```bash
git add components/deep-analysis/career-calibration-question.tsx components/deep-analysis/career-calibration-question.test.tsx components/deep-analysis/career-calibration-summary.tsx components/deep-analysis/career-calibration-summary.test.tsx components/deep-analysis/deep-analysis-entry.tsx components/deep-analysis/deep-analysis-entry.test.tsx components/deep-analysis/deep-analysis-flow.tsx components/deep-analysis/deep-analysis-flow.test.tsx components/deep-analysis/deep-exploration-page.tsx components/deep-analysis/deep-exploration-page.test.tsx components/deep-analysis/direction-picker.tsx components/deep-analysis/question-step.tsx components/deep-analysis/question-step.test.tsx
git commit -m "feat: add career calibration experience"
```

### Task 4: Payment and report API boundaries that reject legacy generation

**Files:**
- Modify: `app/api/deep-analysis/payment/route.ts`
- Modify: `app/api/deep-analysis/payment/route.test.ts`
- Modify: `app/api/deep-analysis/report/route.ts`
- Modify: `app/api/deep-analysis/report/route.test.ts`
- Delete: `app/api/deep-analysis/custom-questions/route.ts`
- Delete: `app/api/deep-analysis/custom-questions/route.test.ts`

**Interfaces:**
- Payment client sends `{ sessionId }`; the route binds the existing signed receipt to `CAREER_DIRECTION_ID` internally.
- Report client sends `{ sessionId, paymentReceipt, questionnaireVersion: 'career-v1', baseReport, baseReportSnapshotToken, careerCalibration }`; it never sends birth input, chart data, a direction choice, or raw hidden answers. The token makes the exact base report an immutable server-signed handoff.
- Report route validates the strict request schema, verifies the signed base snapshot, then verifies the receipt before calling market research or the report provider.

- [ ] **Step 1: Write failing payment boundary tests**

Assert that a valid `{sessionId}` request reaches the unchanged payment service with internal direction `work`; any client-supplied `directionId`, unknown field, or legacy direction is rejected before checkout/payment; receipt issue/verify remains backward compatible for valid career receipts.

- [ ] **Step 2: Run payment tests and confirm RED**

Run: `npx vitest run app/api/deep-analysis/payment/route.test.ts`

Expected: FAIL because the current route requires a client direction.

- [ ] **Step 3: Bind career direction in the route without changing payment core behavior**

Keep signing algorithm, TTL, mock outcome, Alipay checkout, notify verification, and order state unchanged.

- [ ] **Step 4: Write failing report-boundary and legacy-disconnection tests**

Assert strict acceptance of the new structured payload; rejection of birth input, raw answer maps, v1/v2 questionnaires, selected directions, custom questions, and extra fields; changed/forged/unsigned base snapshots fail before payment-bound work; invalid receipt returns 402 and search/generate spies remain untouched. The removed custom-question URL is verified as 404/405 against the production build in Task 8.

- [ ] **Step 5: Run report tests and confirm RED**

Run: `npx vitest run app/api/deep-analysis/report/route.test.ts`

Expected: FAIL because the route still accepts the legacy contract and the custom route exists.

- [ ] **Step 6: Implement the strict career request contract and delete the custom API**

Do not call `createChart`; career analysis receives only the verified read-only completed `baseReport`. Persist only normalized `careerCalibration` under the existing JSON column.

- [ ] **Step 7: Run Task 4 tests and commit**

Run: `npx vitest run app/api/deep-analysis/payment/route.test.ts app/api/deep-analysis/report/route.test.ts lib/deep-analysis/payment.test.ts app/api/deep-analysis/payment/status/route.test.ts app/api/deep-analysis/payment/notify/route.test.ts`

Expected: PASS.

```bash
git add app/api/deep-analysis/payment/route.ts app/api/deep-analysis/payment/route.test.ts app/api/deep-analysis/report/route.ts app/api/deep-analysis/report/route.test.ts app/api/deep-analysis/custom-questions/route.ts app/api/deep-analysis/custom-questions/route.test.ts
git commit -m "feat: enforce career-only paid generation"
```

### Task 5: Ordered server pipeline, market adapter, prompt, and career report schema

**Files:**
- Create: `lib/deep-analysis/career-pipeline.ts`
- Create: `lib/deep-analysis/career-pipeline.test.ts`
- Create: `lib/deep-analysis/prompts/career.ts`
- Create: `lib/deep-analysis/prompts/career.test.ts`
- Modify: `lib/deep-analysis/research/jobs.ts`
- Modify: `lib/deep-analysis/research/jobs.test.ts`
- Modify: `lib/deep-analysis/research/schema.ts`
- Modify: `lib/deep-analysis/gemini.ts`
- Modify: `lib/deep-analysis/gemini.test.ts`
- Modify: `lib/deep-analysis/types.ts`
- Modify: `lib/deep-analysis/stream.test.ts`
- Modify: `lib/report-provider/index.ts`
- Modify: `lib/report-provider/sample.ts`
- Modify: `lib/report-provider/sample.test.ts`
- Modify: `lib/deep-analysis/persistence.ts`
- Modify: `lib/deep-analysis/persistence.test.ts`

**Interfaces:**
- Produces `CareerAnalysisInputSchema` with ordered fields `baseTendencies`, `hardConstraints`, `careerCapital`, `marketEvidence`, `valuePreferences`.
- Produces `createCareerAnalysisInput(verifiedBaseReport, calibration)`, `createCareerResearchContext(input)`, and `createCareerReportPrompt(input)`.
- Produces `CareerReportSchema` with `kind: 'career-calibration'`, `realityBoundaries`, `transferableCapital`, `careerHypotheses` (3–5), `deprioritizedDirections` (0–3), `thirtyDayPlan` (1–3), top-level `marketStatus: verified | partial | unavailable | sample`, and a short disclaimer. Every hypothesis also carries `evidenceStatus: verified | partial | unavailable`, `sourceCount`, and validated `sources`.
- Keeps `LegacyDeepReportSchema` as parse/render-only compatibility; `DeepReportSchema` accepts both, but only `CareerReportSchema` is a generation target.

- [ ] **Step 1: Write failing deterministic pipeline tests**

Assert that base tendencies are derived only from the supplied completed report, hard constraints precede career capital, values remain a separate sorter, and Case A–D normalize into materially different constraint/capital profiles. Include a report body containing instruction-like text and assert it is serialized as escaped inert data under the base-tendencies section.

- [ ] **Step 2: Run pipeline tests and confirm RED**

Run: `npx vitest run lib/deep-analysis/career-pipeline.test.ts lib/deep-analysis/prompts/career.test.ts`

Expected: FAIL because the ordered career pipeline and prompt do not exist.

- [ ] **Step 3: Implement ordered input builders and prompt**

The prompt requires hard-constraint filtering before any ranking, limits output to 3–5 hypotheses, makes market-data uncertainty explicit, and prohibits changing the base report or treating values as hard constraints. If market evidence is unavailable, it must still produce 3–5 personal/constraint-based hypotheses while visibly marking market feasibility as unverified rather than inventing facts.

- [ ] **Step 4: Write failing post-payment research tests**

Assert research accepts only extracted career keywords plus necessary region/threshold labels, never birth data or raw family/free-text fields; verified sources survive existing domain/path checks; unavailable search returns explicit status without fabricated evidence. Assert the report handler invokes receipt verification before research.

- [ ] **Step 5: Run research tests and confirm RED**

Run: `npx vitest run lib/deep-analysis/research/jobs.test.ts app/api/deep-analysis/report/route.test.ts`

Expected: FAIL because research still consumes the legacy answer map and is not represented in the ordered input.

- [ ] **Step 6: Implement career research context and schema-validated report generation**

Reuse Google Search grounding and source validation. The sample provider returns an offline career report with `marketStatus: 'sample'`, per-hypothesis `evidenceStatus: 'unavailable'`, and no invented recruitment facts. Search failure degrades to `unavailable`; it does not throw away the rest of the report.

- [ ] **Step 7: Write failing persistence tests**

Assert normalized career calibration and career report JSON are stored in existing columns, while birth input and raw draft-only answers are absent.

- [ ] **Step 8: Implement persistence event changes and run Task 5 tests**

Run: `npx vitest run lib/deep-analysis/career-pipeline.test.ts lib/deep-analysis/prompts/career.test.ts lib/deep-analysis/research/jobs.test.ts lib/deep-analysis/gemini.test.ts lib/deep-analysis/stream.test.ts lib/report-provider/sample.test.ts lib/deep-analysis/persistence.test.ts app/api/deep-analysis/report/route.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```bash
git add lib/deep-analysis/career-pipeline.ts lib/deep-analysis/career-pipeline.test.ts lib/deep-analysis/prompts/career.ts lib/deep-analysis/prompts/career.test.ts lib/deep-analysis/research/jobs.ts lib/deep-analysis/research/jobs.test.ts lib/deep-analysis/research/schema.ts lib/deep-analysis/gemini.ts lib/deep-analysis/gemini.test.ts lib/deep-analysis/types.ts lib/deep-analysis/stream.test.ts lib/report-provider/index.ts lib/report-provider/sample.ts lib/report-provider/sample.test.ts lib/deep-analysis/persistence.ts lib/deep-analysis/persistence.test.ts app/api/deep-analysis/report/route.test.ts
git commit -m "feat: generate evidence-aware career hypotheses"
```

### Task 6: Career report renderer and read-only legacy compatibility

**Files:**
- Create: `components/deep-analysis/career-report-view.tsx`
- Create: `components/deep-analysis/career-report-view.test.tsx`
- Modify: `components/deep-analysis/deep-report-view.tsx`
- Modify: `components/deep-analysis/deep-report-view.test.tsx`
- Modify: `components/deep-analysis/deep-report-page.tsx`
- Modify: `components/deep-analysis/deep-report-page.test.tsx`
- Modify: `components/deep-analysis/deep-generating-modal.tsx`

**Interfaces:**
- `CareerReportView({ report: CareerReport })` renders the exact report order from the spec.
- `DeepReportView` dispatches by schema kind: new career report or old read-only report.
- Legacy reports never render a link/button that creates a new legacy direction.

- [ ] **Step 1: Write failing career report layout tests**

Assert 3–5 hypotheses, natural-language tiers, reality fit, barrier, transferable assets, risk, source status, minimum-cost experiment, 0–3 deprioritized directions, at most three 30-day actions, and the short disclaimer. Assert no “最适合 / 唯一方向 / 你必须辞职” copy is introduced by static UI.

- [ ] **Step 2: Run report tests and confirm RED**

Run: `npx vitest run components/deep-analysis/career-report-view.test.tsx components/deep-analysis/deep-report-view.test.tsx`

Expected: FAIL because the career renderer does not exist.

- [ ] **Step 3: Implement career report rendering with source states**

Keep information scannable: boundaries and capital first, hypotheses as the dominant cards, deprioritized directions collapsed/secondary, then the action plan. Do not show a generic long-article card stream for new reports.

- [ ] **Step 4: Write failing legacy-read-only and loading tests**

Assert old reports still render but have only a return-to-base action; no “重新选择方向” action appears. Assert loading copy follows the six real stages and contains no fake percentage.

- [ ] **Step 5: Implement legacy read-only actions and staged loading**

Map SSE stages to the approved career wording. Preserve cancel/retry behavior and the full-screen portal overlay.

- [ ] **Step 6: Run Task 6 tests and commit**

Run: `npx vitest run components/deep-analysis/career-report-view.test.tsx components/deep-analysis/deep-report-view.test.tsx components/deep-analysis/deep-report-page.test.tsx components/deep-analysis/deep-analysis-flow.test.tsx`

Expected: PASS.

```bash
git add components/deep-analysis/career-report-view.tsx components/deep-analysis/career-report-view.test.tsx components/deep-analysis/deep-report-view.tsx components/deep-analysis/deep-report-view.test.tsx components/deep-analysis/deep-report-page.tsx components/deep-analysis/deep-report-page.test.tsx components/deep-analysis/deep-generating-modal.tsx
git commit -m "feat: render career calibration reports"
```

### Task 7: Responsive styling, accessibility, analytics seam, and product documentation

**Files:**
- Create: `lib/analytics/career-events.ts`
- Create: `lib/analytics/career-events.test.ts`
- Modify: `app/globals.css`
- Modify: `app/explore/page.tsx`
- Modify: `app/deep-report/page.tsx`
- Modify: `components/deep-analysis/deep-analysis-flow.tsx`
- Modify: `components/deep-analysis/deep-analysis-flow.test.tsx`
- Modify: `README.md`

**Interfaces:**
- `trackCareerEvent(name, metadata)` accepts only the six approved event names and non-sensitive metadata (`questionId`, `section`, `skipped`, elapsed milliseconds); default adapter is a no-storage no-op.
- Page metadata uses “职业专项分析” and “职业专项报告”.

- [ ] **Step 1: Write failing analytics privacy tests**

Assert all six event names are accepted, arbitrary names are rejected by TypeScript/schema, and raw answer text/income/family/city fields cannot be passed as metadata.

- [ ] **Step 2: Run analytics tests and confirm RED**

Run: `npx vitest run lib/analytics/career-events.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the no-storage analytics seam and wire lifecycle calls**

Do not add a third-party SDK or log payloads to the console.

- [ ] **Step 4: Add responsive and accessibility assertions to existing component tests**

Assert semantic fields, focusable actions, alert/status regions, visible selection marks, and CSS class hooks for single-column fallback and fixed action footer. Keep source-order reading meaningful without CSS.

- [ ] **Step 5: Implement scoped styles and documentation**

Add only career-flow selectors, reuse CSS variables, ensure `min-width: 0`, safe-area/dynamic viewport handling, 44px targets, focus-visible outlines, reduced motion, and no horizontal overflow. Update README paths, data boundaries, post-payment search timing, legacy API closure, and session persistence.

- [ ] **Step 6: Run Task 7 tests, lint touched files, and commit**

Run: `npx vitest run lib/analytics/career-events.test.ts components/deep-analysis/career-calibration-question.test.tsx components/deep-analysis/career-calibration-summary.test.tsx components/deep-analysis/career-report-view.test.tsx`

Run: `npx eslint lib/analytics/career-events.ts components/deep-analysis app/explore/page.tsx app/deep-report/page.tsx`

Expected: PASS with zero errors.

```bash
git add lib/analytics/career-events.ts lib/analytics/career-events.test.ts app/globals.css app/explore/page.tsx app/deep-report/page.tsx components/deep-analysis/deep-analysis-flow.tsx components/deep-analysis/deep-analysis-flow.test.tsx README.md
git commit -m "polish: finish career calibration experience"
```

### Task 8: Full regression, mobile browser verification, and protected-file audit

**Files:**
- Modify only if a failure attributable to this feature requires a tested fix.
- Never modify or stage: `lib/gemini/prompt.ts`, `lib/bazi/**`, or `lib/validation.ts`. `components/birth-form.tsx` may contain only the tested snapshot-token transport change from Task 2; its birth-input behavior must remain unchanged.

**Interfaces:**
- Produces fresh evidence that the repository is shippable and that the protected base-report change remains untouched.

- [ ] **Step 1: Run TypeScript, lint, full tests, and production build**

Run:

```bash
npx tsc --noEmit
npm run lint
npm test -- --testTimeout=60000
npm run build
```

Expected: all commands exit 0; record exact test/file counts from Vitest.

- [ ] **Step 2: Verify route and API closure in the production build**

Start the built app locally and verify `/`, `/explore`, and `/deep-report` respond correctly; `/api/deep-analysis/custom-questions` returns 404/405; forged v1/v2/industry/city/collaboration/custom report and payment requests return 400/410 without research/model calls.

- [ ] **Step 3: Run the four reference cases through the sample provider**

Verify each reaches summary before payment, answers survive backward navigation/refresh, the same base report narrows differently for Cases A–D, and sample mode never calls Gemini or invents market facts.

- [ ] **Step 4: Inspect mobile layouts in real browser viewports**

At 375 by 667, 390 by 844, and 430 by 932 plus desktop, inspect intro, longest option question, other input, summary, payment, loading, career report, error, and disabled/selected/focus states. Confirm no horizontal overflow and that browser chrome does not cover actions.

- [ ] **Step 5: Audit the diff and protected file**

Run:

```bash
git diff --check
git status --short
git diff -- lib/gemini/prompt.ts
git diff -- lib/bazi lib/validation.ts
git diff -- components/birth-form.tsx
```

Expected: `lib/gemini/prompt.ts` still shows only the user's pre-existing unstaged change; `lib/bazi/**` and `lib/validation.ts` have no feature diff; `components/birth-form.tsx` contains only the tested snapshot-token transport change and no birth-input behavior change. Do not stage `prompt.ts`.

- [ ] **Step 6: Commit only any tested verification fixes**

Stage explicit paths only. Never use `git add -A` or `git add .` in this worktree.

- [ ] **Step 7: Push and verify Vercel only after the user requests deployment**

Push `codex/bazi-mvp`, wait for the Vercel production deployment, then verify the three public routes and the removed custom API. Deployment is not implied by local implementation approval.
