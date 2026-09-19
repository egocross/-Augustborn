const configuredProvider = process.env.GEMINI_PROVIDER?.trim().toLowerCase();

export type GeminiProvider = 'google' | 'kie';

/** Which report API to call. Defaults to Kie so existing deployments keep working. */
export const GEMINI_PROVIDER: GeminiProvider =
  configuredProvider === 'google' || configuredProvider === 'kie' ? configuredProvider : 'kie';

/** Optional model override. Each adapter falls back to its own provider default. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || undefined;

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
