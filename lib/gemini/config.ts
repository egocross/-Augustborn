export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-pro-openai';

const reasoningEfforts = ['low', 'medium', 'high'] as const;

export type GeminiReasoningEffort = (typeof reasoningEfforts)[number];

/** Server-only setting. Keep the production default at the highest reasoning level. */
export const GEMINI_REASONING_EFFORT: GeminiReasoningEffort = reasoningEfforts.includes(
  process.env.GEMINI_REASONING_EFFORT as GeminiReasoningEffort,
)
  ? (process.env.GEMINI_REASONING_EFFORT as GeminiReasoningEffort)
  : 'high';

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const KIE_GEMINI_BASE_URL = 'https://api.kie.ai/gemini-3.1-pro/v1';
