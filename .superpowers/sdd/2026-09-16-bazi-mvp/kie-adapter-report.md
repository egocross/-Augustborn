# Kie AI Gemini adapter report

Date: 2026-09-16

## Outcome

The report provider boundary now uses the `openai` SDK against Kie AI's
OpenAI-compatible Gemini 3.1 Pro chat-completions API. The public contract
remains `generateReport(chart): Promise<Report>`; the same Zod-derived dynamic
JSON schema is sent to the provider and the response is still validated with
`parseReport` before returning it.

## Provider configuration

- API key: the existing server-only `GEMINI_API_KEY` is used as the Kie AI
  bearer key. No key was read, written, logged, or added to a file.
- Base URL: `https://api.kie.ai/gemini-3.1-pro/v1`, kept in
  `lib/gemini/config.ts`; the SDK appends `/chat/completions`.
- Default model: `gemini-3.1-pro-openai`.
- Structured output: `response_format.type = "json_schema"` with
  `ReportJsonSchema`, named `bazi_report`, and `strict: true`.
- Reasoning: Kie's Gemini 3.1 Pro OpenAI endpoint documents
  `reasoning_effort: "high"`; this replaces Google-specific
  `thinkingLevel: HIGH`. No unsupported Google-only field is sent.
- Safety: `lib/gemini/prompt.ts` is unchanged, so the grounded,
  non-deterministic, no-professional-advice policy remains in force.

## Documentation sources consulted

1. [Kie AI: Gemini 3.1 Pro (openai)](https://docs.kie.ai/30442144e0) — confirms
   `POST /gemini-3.1-pro/v1/chat/completions`, bearer authentication, Kie's full
   API URL, and its `reasoning_effort: "high"` request example.
2. [Kie AI: Gemini 3.1 Pro](https://kie.ai/gemini-3-1-pro) — shows the
   `gemini-3.1-pro-openai` model identifier specified for the default.
3. [Kie AI: Gemini 3 Pro (openai)](https://docs.kie.ai/market/gemini/gemini-3-pro)
   — documents the OpenAI-compatible `response_format` JSON Schema shape used
   to preserve structured report generation. The rendered 3.1 endpoint page
   does not separately enumerate this parameter, so no other unverified
   provider-specific fields were added.

## TDD evidence

The regression test was changed first to require the OpenAI SDK constructor,
the Kie base URL/model, `reasoning_effort: "high"`, the JSON schema payload,
and successful parsing of an OpenAI chat-completion response.

- RED: `npm run test -- lib/gemini/generate-report.test.ts` failed with
  `OpenAI` called zero times while the old Google adapter was still active.
- GREEN: the same command passed after replacing the adapter.

## Dependency and documentation changes

- Added `openai@^7.15.0` and removed `@google/genai` (verified with
  `npm ls @google/genai --depth=0`, which reports an empty tree).
- Updated `.env.example` and `README.md` to describe a Kie AI
  OpenAI-compatible key, the fixed base URL, and the new default model. They
  contain no Google AI Studio key instructions.

## Final verification

All commands were run after the implementation and documentation changes:

| Command | Result |
| --- | --- |
| `npm run test` | 10 test files, 35 tests passed |
| `npm run lint` | passed |
| `npx tsc --noEmit` | passed |
| `npm run build` | passed; Next.js production build completed |

Vitest emits an existing Vite configuration deprecation warning during tests;
it does not affect the passing result.
