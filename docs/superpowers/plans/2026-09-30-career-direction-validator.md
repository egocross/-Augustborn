# Career Direction Validator V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a paid career-report reader run one recoverable, evidence-aware career experiment, submit Markdown, reflect, receive a bounded result and take one next action.

**Architecture:** Keep the paid report and payment flow as the upstream authority. Issue a per-career capability only after the report is confirmed in Supabase, then create an independent `CareerValidationSession` with a frozen context. Store authoritative state in a new Supabase table and unsynced drafts in a namespaced localStorage envelope; use atomic leases for Gemini calls and revision checks for edits.

**Tech Stack:** Next.js 16.3.5 App Router, React 19.2.8, TypeScript, Zod 4.6.5, `@google/genai`, Supabase Postgres/service role, Vitest 4.1.11, Testing Library, Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-09-30-career-direction-validator-design.md`

## Global Constraints

- Keep `lib/gemini/prompt.ts` untouched and unstaged; it contains user-owned changes.
- Keep base report, calibration, paid career selection, payment core, existing `workValidation` contract and brand visual system intact.
- No file upload, object storage, URL fetch/preview, account system, cross-device recovery promise or external-action progress tracker.
- Public links are HTTPS-only records; never send `publicResultUrl` to Gemini. UI copy: “AI 没有访问或读取此链接内容；本次评价仅基于你粘贴的文字与复盘答案。”
- Markdown is plain text: 20–30000 characters; `attachments` is always `[]`. Show “请勿粘贴公司机密、客户隐私、未公开业务数据或其他敏感信息。”
- Four fixed Reflection fields; no generated `reflectionPrompts`.
- Capability binds `reportId`, `careerId`, `validationSessionId`, scope and expiry. `CAREER_VALIDATION_CAPABILITY_TTL_SECONDS` defaults to 2592000; `CAREER_VALIDATION_RETENTION_DAYS` defaults to 180.
- Status is exactly `worth_continuing | insufficient_evidence | do_not_increase_investment`; evidence signals are `support | mixed | no_evidence | risk`.
- Only `nextAction.type === 'in_product_experiment' && canStartInProduct === true` may create a child, and only on user action.
- Run all API operations server-side with a service role. Keep capability out of URL, logs and analytics.
- Follow the repository's `AGENTS.md`: read relevant `node_modules/next/dist/docs/` guidance before implementing route handlers or dynamic pages.

## Review Focus

1. **Report persistence unavailable:** deliver the paid report but issue no validator capability or CTA; Task 4 tests this.
2. **Duplicate career titles:** derive `careerId` from report position plus a stable title digest; Task 4 tests that two same-title cards receive distinct capabilities.
3. **Two concurrent Gemini requests or a deleted session:** only one lease holder calls the model and stale output cannot land; Tasks 6 and 8 test this.
4. **Two tabs and unavailable localStorage:** preserve an unsynced draft and expose a recoverable conflict/storage warning; Task 11 tests this.
5. **No trusted market source or an unverified credential barrier:** label the limitation, avoid fabricated facts and use the safe fallback; Tasks 1 and 6 test this.

---

## File map and dependency order

| Area | Files | Responsibility |
|---|---|---|
| Contracts and snapshot | `lib/career-validation/schema.ts`, `snapshot.ts` | Strict data types and one-time server snapshot construction |
| Access and configuration | `lib/career-validation/capability.ts`, `config.ts` | Signed least-privilege token, TTL/retention values |
| Persistence and lifecycle | `supabase/career-validation-sessions.sql`, `lib/career-validation/repository.ts` | Atomic claims, revisions, child uniqueness, tombstones, retention |
| Experiment and evaluation | `lib/career-validation/experiment.ts`, `evaluation.ts`, `prompts.ts` | Trusted model inputs, structured results and deterministic fallback |
| API | `app/api/career-validation/{session,experiment,analyze,next}/route.ts` | Thin authenticated orchestration |
| Existing paid-report seam | `app/api/deep-analysis/report/route.ts`, `lib/deep-analysis/stream.ts`, `lib/deep-analysis/session.ts`, report components | Issue and retain initial access after confirmed persistence |
| Browser experience | `app/career-validation/[validationSessionId]/page.tsx`, `components/career-validation/*`, `lib/career-validation/local.ts`, `app/globals.css` | Mobile five-step flow and draft recovery |
| Cleanup | `app/api/career-validation/retention/route.ts`, `vercel.json` | Scheduled content erasure and tombstone cleanup |

Implement tasks in the order below. Every task starts with its focused failing test, verifies the failure, implements the minimum behavior, reruns the focused test, and commits only its own files. Use `npm test -- <test-file>` for each focused run. The final task runs broader checks once.

### Task 1: Strict contracts and trusted context snapshot

**Files:**
- Create: `lib/career-validation/schema.ts`, `lib/career-validation/schema.test.ts`
- Create: `lib/career-validation/snapshot.ts`, `lib/career-validation/snapshot.test.ts`

**Interfaces:**
- Consumes: `CareerReport`, `CareerCalibration`, `CareerWorkValidation` from existing `lib/deep-analysis` modules and an already persisted report row.
- Produces: `ValidationContextSnapshotSchema`, `CareerExperimentDraftSchema` (model output), `CareerExperimentSchema` (server metadata included), `SubmissionSchema`, `ReflectionSchema`, `EvidenceItemSchema`, `ValidationNextActionSchema`, `ValidationResultDraftSchema` (model output), `ValidationResultSchema` (server metadata included), `CareerValidationSessionSchema` and corresponding `z.infer` types.
- Produces: `careerIdForHypothesis(reportId: string, index: number, title: string): string`, `buildInitialSnapshot(input: { reportId: string; careerId: string; report: CareerReport; calibration: CareerCalibration; reportCapturedAt: string; frozenAt: string }): ValidationContextSnapshot` and `buildChildSnapshot(parent: CareerValidationSession, childId: string, frozenAt: string): ValidationContextSnapshot`.

- [ ] Write failing tests: strict `CareerExperimentSchema` rejects `reflectionPrompts`; Reflection requires all four enumerated answers; Submission rejects non-HTTPS URL, nonempty attachments and out-of-range content; NextAction rejects `canStartInProduct: true` for all non-product types.
- [ ] Write failing snapshot tests: server-bound `careerId` selects one hypothesis even when titles repeat; upstream report mutation after creation does not change the snapshot; child copies only the parent snapshot and minimum result summary; URL without a server-accepted source never enters `marketEvidence`; credential claims without an official source remain unverified.
- [ ] Run `npm test -- lib/career-validation/schema.test.ts lib/career-validation/snapshot.test.ts` and confirm failures from missing contracts.
- [ ] Implement schemas using Zod `.strict()` for model/API objects and deterministic `contextHash` over canonical snapshot JSON excluding `contextHash`. Map existing evidence fields exactly; use `reportCapturedAt` as record capture time and label it as such, never as a claimed source publication date.
- [ ] Rerun the two focused tests and commit only these four files.

### Task 2: Database, repository and retention settings

**Files:**
- Create: `supabase/career-validation-sessions.sql`
- Create: `lib/career-validation/config.ts`, `lib/career-validation/config.test.ts`
- Create: `lib/career-validation/repository.ts`, `lib/career-validation/repository.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: Task 1 session and snapshot types.
- Produces: `getCareerValidationConfig(env): { capabilityTtlSeconds: number; retentionDays: number; leaseSeconds: number }`, `CareerValidationRepository` with `get`, `createInitial`, `claimOperation`, `completeExperiment`, `completeAnalysis`, `patch(expectedRevision)`, `createChild`, `erase`, `sweepExpired`.
- Every mutator accepts `validationSessionId`; `claimOperation` returns a random operation token or `in_progress`; completion requires that same token.

- [ ] Write failing config tests: default 2592000 seconds/180 days, configured overrides and invalid/nonpositive values. Permit retention shorter than capability TTL; erase content at retention expiry while keeping the minimal tombstone through capability expiry plus the replay window.
- [ ] Write repository contract tests using an injected Supabase-like client: duplicate create returns the existing row; revision mismatch is `VERSION_CONFLICT`; one active lease per operation; expired lease may be reclaimed; a stale token or deleted row cannot accept output; one child per parent; deletion clears content without cascading; cleanup preserves a tombstone through token expiry.
- [ ] Run `npm test -- lib/career-validation/config.test.ts lib/career-validation/repository.test.ts` and confirm failures.
- [ ] Add the new table, RLS/revoke, parent unique index, status CHECK and immutable-content guards. Implement atomic compare-and-swap updates and unique-child insert; if PostgREST queries cannot express an atomic transition, put only that transition in a narrowly scoped SQL RPC in this migration. Do not use in-memory locking.
- [ ] Rerun focused tests. Commit only the SQL, configuration, repository, tests and `.env.example`.

### Task 3: Capability signing and API authorization boundary

**Files:**
- Create: `lib/career-validation/capability.ts`, `lib/career-validation/capability.test.ts`
- Create: `lib/career-validation/authorize.ts`, `lib/career-validation/authorize.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: Task 2 configuration and repository.
- Produces: `issueValidationCapability(input: { reportId: string; careerId: string; validationSessionId: string; issuedAt: number; ttlSeconds: number }, secret: string): string`, `verifyValidationCapability(token: string, expectedSessionId: string, secret: string, now?: number): CareerValidationCapability | null`, and `authorizeValidationSession(token: string, expectedSessionId: string): Promise<CareerValidationSession>`.
- The authorization helper checks the signed scope, report/career/session binding, DB row, expiry, retention and tombstone state before returning data. Initial session creation verifies the signed capability first, then loads the paid report because the validator row does not yet exist.

- [ ] Write failing tests for changed report/career/session/scope, malformed signature, expiry boundary, row binding mismatch, deleted row and missing server secret.
- [ ] Run `npm test -- lib/career-validation/capability.test.ts lib/career-validation/authorize.test.ts` and confirm failures.
- [ ] Implement constant-time signature comparison, server-only secret `CAREER_VALIDATION_CAPABILITY_SECRET` documented in `.env.example`, configured TTL, stable `SESSION_GONE`/`SESSION_NOT_FOUND` semantics, and an exact token reconstruction from stored issued/expiry times for a repeated `/next` request.
- [ ] Rerun focused tests and commit only Task 3 files.

### Task 4: Issue initial access from a persisted paid report

**Files:**
- Modify: `app/api/deep-analysis/report/route.ts`, `app/api/deep-analysis/report/route.test.ts`
- Modify: `lib/deep-analysis/stream.ts`, `lib/deep-analysis/stream.test.ts`
- Modify: `lib/deep-analysis/session.ts`, `lib/deep-analysis/session.test.ts`
- Modify: `components/deep-analysis/deep-analysis-flow.tsx`, `components/deep-analysis/deep-analysis-flow.test.tsx`
- Create: `lib/career-validation/report-access.ts`, `lib/career-validation/report-access.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 plus the existing persisted `deep_report_sessions.report_result` and `answers`.
- Produces: `ValidationAccess = { careerId: string; validationSessionId: string; capability: string }`, `createInitialValidationAccess(input: { reportId: string; report: CareerReport; persisted: boolean; issuedAt: number; ttlSeconds: number; secret: string }): ValidationAccess[]`, and optional SSE `{ type: 'validationAccess'; items: ValidationAccess[] }` before the final report event.
- `careerId` comes from Task 1's deterministic index-and-title-digest helper, so duplicate titles are distinct. The same mapping is used by snapshot selection and report UI; the secret never leaves server-only code except inside the signed capability.

- [ ] Write failing route/stream/state tests: access is sent and saved only after persistence success; report still arrives without access if persistence fails; two same-title hypotheses have distinct IDs; legacy and old stored reports remain readable; access is omitted if report row uses an invalid UUID ID and cannot be loaded from Supabase.
- [ ] Run `npm test -- app/api/deep-analysis/report/route.test.ts lib/deep-analysis/stream.test.ts lib/deep-analysis/session.test.ts components/deep-analysis/deep-analysis-flow.test.tsx lib/career-validation/report-access.test.ts` and confirm failures.
- [ ] Implement optional `validationAccess` SSE handling, `DeepFlowState` V3→V4 migration, and confirmed-persistence signing. Treat the existing best-effort `persistDeepSession` result as the gate; never use the payment receipt as later validator authorization. Do not change paid report generation or payment verification.
- [ ] Rerun focused tests and commit only Task 4 files.

### Task 5: Create and restore a frozen validation session

**Files:**
- Create: `lib/career-validation/session-service.ts`, `lib/career-validation/session-service.test.ts`
- Create: `app/api/career-validation/session/route.ts`, `app/api/career-validation/session/route.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 and the persisted report/calibration row.
- Produces: `createOrRestoreSession(token: string): Promise<CareerValidationSession>` and `POST /api/career-validation/session` request `{ capability: string }`; response contains the bound session projection and revision but never the original report or payment data.

- [ ] Write failing tests: first call freezes report/career/calibration into one snapshot; repeated call returns identical snapshot/hash; forged or cross-career token fails; missing/unpaid/incomplete report fails closed; deleted ID yields 410; upstream report changed later cannot alter an existing session.
- [ ] Run `npm test -- lib/career-validation/session-service.test.ts app/api/career-validation/session/route.test.ts` and confirm failures.
- [ ] Implement a server-only read of `deep_report_sessions` scoped to bound report ID, verify `payment_status = paid` and `report_status = complete`, then `createInitial` with insert-on-conflict return. For existing sessions read their own snapshot only. Do not accept client report JSON.
- [ ] Rerun focused tests and commit only Task 5 files.

### Task 6: Generate and freeze one career experiment

**Files:**
- Create: `lib/career-validation/prompts.ts`, `lib/career-validation/experiment.ts`, `lib/career-validation/experiment.test.ts`
- Create: `app/api/career-validation/experiment/route.ts`, `app/api/career-validation/experiment/route.test.ts`

**Interfaces:**
- Consumes: Task 1 snapshot/schema; Tasks 2–3 repository, lease and authorization.
- Produces: `generateCareerExperiment(session: CareerValidationSession, signal?: AbortSignal): Promise<CareerExperiment>` and `POST /api/career-validation/experiment` request `{ capability: string }`.

- [ ] Write failing tests: model input contains only current frozen snapshot and prompt; `reflectionPrompts` fails Schema; one concurrent request gets the lease and the other 202; persisted experiment is returned unchanged on retry/refresh; stale token and delete during model call cannot write back.
- [ ] Add fallback tests: a complete safe `workValidation` can form a deterministic experiment; 1–3 trusted sources with incomplete task data yield `job_reality_review`; zero sources yield `core_work_awareness`; regulatory barriers are shown before work; no fallback invents recruitment facts.
- [ ] Run `npm test -- lib/career-validation/experiment.test.ts app/api/career-validation/experiment/route.test.ts` and confirm failures.
- [ ] Implement a structured Gemini call through the existing provider seam (`REPORT_PROVIDER=sample` must use deterministic local output). Save experiment version, generator/prompt/model/rubric IDs and operation token atomically. Return 202 for an active lease; recover an expired lease safely.
- [ ] Rerun focused tests and commit only Task 6 files.

### Task 7: Save Markdown, link and fixed reflection with revisions

**Files:**
- Modify: `app/api/career-validation/session/route.test.ts` with PATCH cases
- Modify: `app/api/career-validation/session/route.ts`
- Create: `lib/career-validation/draft-service.ts`, `lib/career-validation/draft-service.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 Session/Submission/Reflection schemas, repository and capability.
- Produces: `saveValidationDraft(input: { capability: string; expectedRevision: number; patch: ValidationDraftPatch }): Promise<{ session: CareerValidationSession; revision: number }>` and PATCH route with `409 { code: 'VERSION_CONFLICT', latestRevision }`.

- [ ] Write failing tests: only submission/reflection/allowed status can change; 20–30000-character submitted text; HTTPS-only link; attachments always `[]`; fixed four answers required at submission; stale revision returns 409 without overwriting either version; completed/deleted sessions reject edits.
- [ ] Run `npm test -- lib/career-validation/draft-service.test.ts app/api/career-validation/session/route.test.ts` and confirm failures.
- [ ] Implement strict patch allowlist and repository compare-and-swap. Accept an incomplete local draft in `in_progress`, but require the complete Submission and Reflection before `submitted`.
- [ ] Rerun focused tests and commit only Task 7 files.

### Task 8: Evaluate evidence and freeze the result

**Files:**
- Create: `lib/career-validation/evaluation.ts`, `lib/career-validation/evaluation.test.ts`
- Modify: `lib/career-validation/prompts.ts`
- Create: `app/api/career-validation/analyze/route.ts`, `app/api/career-validation/analyze/route.test.ts`

**Interfaces:**
- Consumes: frozen experiment/Rubric, current Markdown, four Reflection answers, necessary frozen barriers and parent unknowns; Tasks 2–3 lease/auth.
- Produces: `analyzeValidationSession(session: CareerValidationSession, signal?: AbortSignal): Promise<ValidationResult>` and `POST /api/career-validation/analyze` request `{ capability: string }`.

- [ ] Write failing tests for prompt/input whitelist: publicResultUrl, attachment, other career/session, historical chat and changing upstream report never enter the model call; free-text Markdown is escaped as data.
- [ ] Write failing result tests: distinct `task_performance=support`/`work_experience_feeling=risk` and the reverse survive; no percentage/grade/“验证通过”; exactly one nextAction; invalid `type/canStartInProduct` rejected; `external_feedback=no_evidence` without actual feedback.
- [ ] Write failing route tests for active 202 lease, repeated result reuse without another model call, stale output after deletion/lease expiry, and failed analysis preserving user submission.
- [ ] Run `npm test -- lib/career-validation/evaluation.test.ts app/api/career-validation/analyze/route.test.ts` and confirm failures.
- [ ] Implement structured output with server-side version metadata, Zod validation, a deterministic local result for `REPORT_PROVIDER=sample`, and a retryable `analysis_failed` state. Never fabricate a production result on model failure and never pre-sign a child capability.
- [ ] Rerun focused tests and commit only Task 8 files.

### Task 9: Gate the optional next in-product experiment

**Files:**
- Create: `lib/career-validation/next-service.ts`, `lib/career-validation/next-service.test.ts`
- Create: `app/api/career-validation/next/route.ts`, `app/api/career-validation/next/route.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 snapshot, capability and repository; completed parent result from Task 8.
- Produces: `createNextValidationSession(parentToken: string): Promise<{ validationSessionId: string; capability: string }>` and POST route request `{ capability: string }`.

- [ ] Write failing tests for each of six real-world/pause action types refusing child creation; `in_product_experiment` plus true creating exactly one child; false refusing; repeated/concurrent clicks returning identical child ID and expiry; child gets only copied frozen context plus minimum parent result summary; parent remains unchanged.
- [ ] Run `npm test -- lib/career-validation/next-service.test.ts app/api/career-validation/next/route.test.ts` and confirm failures.
- [ ] Implement the parent-state gate and unique-index conflict recovery. Persist child issued/expiry timestamps once; reconstruct the same capability on retry without extending access.
- [ ] Rerun focused tests and commit only Task 9 files.

### Task 10: Delete one session and enforce retention

**Files:**
- Modify: `app/api/career-validation/session/route.ts`, `app/api/career-validation/session/route.test.ts`
- Create: `lib/career-validation/retention.ts`, `lib/career-validation/retention.test.ts`
- Create: `app/api/career-validation/retention/route.ts`, `app/api/career-validation/retention/route.test.ts`
- Modify: `vercel.json`, `.env.example`

**Interfaces:**
- Consumes: Tasks 2–3 repository and capability.
- Produces: DELETE `/api/career-validation/session` request `{ capability: string }`, `sweepCareerValidationSessions(now: Date): Promise<{ erased: number; purged: number }>`, protected daily GET `/api/career-validation/retention`.

- [ ] Write failing tests: DELETE requires current bound token, clears only current session content, leaves reports and parent/child rows intact, blocks delayed model output and future writes, returns 410 while tombstone remains and 404 after purge.
- [ ] Write failing retention tests: expired content is erased, tombstone remains through expiry plus seven days, later purge preserves child snapshot, no secret or wrong bearer yields 401, local/report/payment data is untouched.
- [ ] Run `npm test -- lib/career-validation/retention.test.ts app/api/career-validation/retention/route.test.ts app/api/career-validation/session/route.test.ts` and confirm failures.
- [ ] Implement idempotent erasure and bounded batch sweep. Configure Vercel Cron for one daily invocation and verify `Authorization: Bearer ${CRON_SECRET}`; add `CRON_SECRET` to `.env.example`. Keep Supabase secrets server-side.
- [ ] Rerun focused tests and commit only Task 10 files.

### Task 11: Browser recovery, report CTA and five-step mobile flow

**Files:**
- Create: `lib/career-validation/local.ts`, `lib/career-validation/local.test.ts`
- Create: `app/career-validation/[validationSessionId]/page.tsx`
- Create: `components/career-validation/validation-page.tsx`, `components/career-validation/validation-page.test.tsx`
- Create: `components/career-validation/validation-result.tsx`, `components/career-validation/validation-result.test.tsx`
- Modify: `components/deep-analysis/deep-report-page.tsx`, `components/deep-analysis/deep-report-view.tsx`, `components/deep-analysis/career-report-view.tsx`
- Modify: `components/deep-analysis/career-report-view.test.tsx`, `components/deep-analysis/deep-report-page.test.tsx`, `components/deep-analysis/deep-report-view.test.tsx`
- Modify: `app/globals.css`, `lib/analytics/career-events.ts`, `lib/analytics/career-events.test.ts`

**Interfaces:**
- Consumes: Task 4 access map and Tasks 5–10 API response contracts.
- Produces: `loadValidationLocal(storage: Storage, sessionId: string): ValidationLocalEnvelope | null`, `saveValidationLocal(storage: Storage, envelope: ValidationLocalEnvelope): void`, `clearValidationLocal(storage: Storage, sessionId: string): void`; accessible responsive page and CTA.

- [ ] Write failing local-storage tests for reload/browser-close recovery, expired envelope cleanup, unavailable/quota-exceeded storage warning, and one session deletion leaving other local sessions intact.
- [ ] Write failing component tests: CTA only with matching access; one validation question; source facts separated from AI synthesis; four fixed Reflection controls; text safety and URL-not-read copy; conflict keeps local Markdown until explicit choice; six real-world action types never call `/next`; only product CTA does; delete requires confirmation and clears one local entry.
- [ ] Run `npm test -- lib/career-validation/local.test.ts components/career-validation/validation-page.test.tsx components/career-validation/validation-result.test.tsx components/deep-analysis/career-report-view.test.tsx components/deep-analysis/deep-report-page.test.tsx components/deep-analysis/deep-report-view.test.tsx` and confirm failures.
- [ ] Implement a Next 16 dynamic page with async `params`, compact five-step UI, 44px targets, no raw Markdown HTML, no horizontal overflow at 375/390/430px, safe-area sticky action, and clear loading/error/expired/deleted states. Register coarse analytics without user text or URLs.
- [ ] Rerun focused tests; run a browser viewport check at 375/390/430px for normal, conflict and result states; commit only Task 11 files.

### Task 12: Whole-flow acceptance and handoff

**Files:**
- Modify only files needed to repair feature-caused regressions.
- Verify: Task 1–11 tests, existing paid-report API/stream/session/report suites and a real browser flow with `REPORT_PROVIDER=sample`.

**Interfaces:**
- Consumes: the complete paid report → validator → next action flow.
- Produces: reviewed implementation and deployment prerequisites, with no changes to the base prompt or payment core.

- [ ] Run a full sample path: paid report persisted → access CTA → frozen context → task → Markdown/link → fixed Reflection → analysis → real-world action or one child experiment → deletion/recovery.
- [ ] Run `npm test`; record any pre-existing failures in `lib/gemini/prompt.test.ts` separately and fix only feature-caused regressions.
- [ ] Run `npx tsc --noEmit`, `npm run lint`, and `npm run build`; inspect the exact output of each.
- [ ] Check `git diff --check`, `git status --short`, `git diff -- lib/gemini/prompt.ts` against the initial user-owned diff, and staged file names before any commit.
- [ ] Confirm new Supabase SQL, `CAREER_VALIDATION_CAPABILITY_SECRET`, `CRON_SECRET`, TTL/retention values and Vercel Cron are deployment prerequisites; do not claim online availability until migration and configuration are applied.

## Plan self-review

- **Spec coverage:** Tasks 1–11 cover contracts, snapshot, access, APIs, leases, drafts, analysis, next action, deletion, retention and UI; Task 12 covers end-to-end acceptance.
- **Interface consistency:** All six API methods use the same signed capability and session ID. Parent/child operations never accept a client-supplied snapshot.
- **Failure focus:** The five Review Focus conditions map to explicit tests in Tasks 1, 4, 6, 8 and 11.
- **Scope:** One new validation subsystem; no migration of the base or paid report formats beyond optional access metadata.
