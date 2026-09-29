# Career Work Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend each paid career hypothesis with evidence-aware work reality, hiring signals, and 2–4 low-cost validation actions for the Chinese employment market.

**Architecture:** Keep the existing signed base-report → calibration → payment → paid generation boundary. Generate server-owned career hypotheses first, then research each standardized career independently, synthesize each career validation with structured output, and attach successful or degraded validation records to the existing report. Render each career as a mobile-first disclosure card with the three decision-critical sections first and source detail collapsible.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod 4, Google GenAI grounding/structured output, Vitest, Testing Library.

**Spec:** `/Users/ego/.codex/attachments/2397b117-8b43-42c1-b197-e2d88a6ca2a9/已粘贴的文本.txt`

## Global Constraints

- Do not redesign or regenerate the base report, calibration questionnaire, payment core, or candidate-career selection flow.
- Preserve the uncommitted user-owned `lib/gemini/prompt.ts` exactly and never stage it.
- Research only after summary confirmation and successful payment.
- Prefer current, public Chinese-market evidence; separate verified facts from model judgments and never fabricate sources, qualifications, salaries, or user history.
- A failure for one career or the search service must degrade that career only, not hide the paid report.
- Each career shows 1–3 critical gaps and 2–4 role-specific validation actions; no forced 30-day template, portfolio, AI demo, certificate, or internal transfer.
- Mobile layouts must work at 375, 390, and 430 px and preserve keyboard-accessible disclosures.

## Review Focus

- A credential-regulated role surfaces the hard barrier before any project advice and never implies a demo replaces qualification.
- An experience-dependent role without relevant experience receives a bridge path instead of a generic demo.
- Search with no verified sources produces an explicit unavailable state and makes JD/interview verification the first action.
- A single failed career synthesis leaves other careers usable and clearly labels the failed career for retry/follow-up.
- Untrusted model URLs or facts never survive the server evidence boundary.

---

### Task 1: Define the work-validation contract and sample report

**Files:**
- Modify: `lib/deep-analysis/types.ts`
- Modify: `lib/report-provider/sample.ts`
- Test: `lib/report-provider/sample.test.ts`

**Interfaces:**
- Consumes: existing `CareerHypothesisSchema` and `CareerReportSchema`.
- Produces: `CareerWorkValidationSchema`, `MarketEvidenceSchema`, `ValidationActionSchema`, and typed validation data attached to every career hypothesis.

- [ ] Write failing schema/sample tests covering work reality, signal type, 1–3 gaps, hard barriers, bridge paths, 2–4 actions, and unavailable evidence.
- [ ] Run the focused test and confirm it fails because the validation contract is absent.
- [ ] Add the minimal schemas/types and sample data required by the tests.
- [ ] Run the focused tests and confirm they pass.
- [ ] Commit only the task files.

### Task 2: Add targeted, cached career research

**Files:**
- Create: `lib/deep-analysis/research/career-validation.ts`
- Create: `lib/deep-analysis/research/career-validation.test.ts`
- Modify: `lib/deep-analysis/research/jobs.ts`

**Interfaces:**
- Consumes: a server-generated career name plus safe region/income/employment context.
- Produces: `researchCareerValidation(career, context, options)` with deduplicated verified sources, facts, confidence, query coverage, cache status, and safe degradation.

- [ ] Write failing tests for safe query construction, per-career cache keys, source deduplication, no-source degradation, and credential-query selection.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement bounded per-career Google Search reuse and an in-process TTL cache without exposing personal/free-text data.
- [ ] Run focused tests and confirm they pass.
- [ ] Commit only the task files.

### Task 3: Generate each career validation independently

**Files:**
- Create: `lib/deep-analysis/prompts/career-validation.ts`
- Create: `lib/deep-analysis/prompts/career-validation.test.ts`
- Modify: `lib/deep-analysis/gemini.ts`
- Modify: `lib/deep-analysis/gemini.test.ts`

**Interfaces:**
- Consumes: existing career report, trusted calibration/capital, and per-career verified research.
- Produces: each hypothesis enriched with a validated `workValidation` record; failures become explicit partial records while other careers continue.

- [ ] Write failing prompt and orchestration tests for no fit re-evaluation, fact/inference separation, role-specific signal mechanisms, per-career continuation, and strict source attachment.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement the structured-output prompt and per-career synthesis loop with source allowlisting and stage callbacks.
- [ ] Run focused tests and confirm they pass.
- [ ] Commit only the task files.

### Task 4: Expose truthful generation stages and preserve trusted boundaries

**Files:**
- Modify: `app/api/deep-analysis/report/route.ts`
- Modify: `app/api/deep-analysis/report/route.test.ts`
- Modify: `components/deep-analysis/deep-generating-modal.tsx`
- Modify: `components/deep-analysis/deep-generating-modal.test.tsx`

**Interfaces:**
- Consumes: generator callbacks `candidate_analysis`, `market_research`, `capability_signals`, `validation_paths`, and `validating`.
- Produces: SSE status events and matching concise mobile loading copy without duplicate overlays.

- [ ] Write failing tests for stage order, partial-success delivery, and user-facing stage copy.
- [ ] Run focused tests and confirm expected failures.
- [ ] Update route stages and modal mappings without changing payment or receipt verification.
- [ ] Run focused tests and confirm they pass.
- [ ] Commit only the task files.

### Task 5: Render the mobile-first work-validation report

**Files:**
- Modify: `components/deep-analysis/career-report-view.tsx`
- Modify: `components/deep-analysis/career-report-view.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: enriched career hypotheses.
- Produces: accessible expandable career panels ordered as work reality → biggest gap → first validation action, followed by capability signals, bridge path, full action cards, and collapsible evidence.

- [ ] Write failing component tests for ordering, disclosures, hard-barrier prominence, degraded evidence, and action-card contents.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement the accessible disclosures and responsive styles using the current visual system.
- [ ] Run focused tests and confirm they pass.
- [ ] Commit only the task files.

### Task 6: End-to-end compatibility and verification

**Files:**
- Modify only files required to repair regressions caused by Tasks 1–5.
- Test: existing API, session, sample, report, and mobile component suites.

**Interfaces:**
- Consumes: the full paid career-report flow.
- Produces: a backward-compatible read path for existing saved career/legacy reports and a verified production build.

- [ ] Add any failing compatibility test needed for old saved reports and unavailable search.
- [ ] Run the complete test suite and fix only regressions caused by this feature.
- [ ] Run `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- [ ] Inspect the final diff to confirm `lib/gemini/prompt.ts` was neither edited nor staged.
- [ ] Commit compatibility fixes and verification tests.
