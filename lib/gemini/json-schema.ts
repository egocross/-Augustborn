import { z } from 'zod';

/**
 * Gemini only accepts a subset of JSON Schema for structured output.
 *
 * Verified against `gemini-3.1-pro-preview`: a schema derived from Zod that carries
 * array-length constraints is rejected with `400 INVALID_ARGUMENT`, and both
 * minItems and maxItems have to go before the same request is accepted. Their numbers
 * move into the property description so the model still sees them, and the original
 * rules stay enforced by Zod when the answer is parsed.
 *
 * The same endpoint also requires numeric exclusive bounds, so the OpenAPI 3.0 style
 * `exclusiveMinimum: true` + `minimum: N` pair is rewritten to `exclusiveMinimum: N`.
 */
const unsupportedKeywords = new Set(['minItems', 'maxItems']);

function stripUnsupported(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stripUnsupported(item));
  if (!value || typeof value !== 'object') return value;
  const input = value as Record<string, unknown>;
  const hints: string[] = [];
  if (typeof input.minItems === 'number') hints.push('至少 ' + input.minItems + ' 项');
  if (typeof input.maxItems === 'number') hints.push('最多 ' + input.maxItems + ' 项');
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(input)) {
    if (unsupportedKeywords.has(key)) continue;
    if (key === 'exclusiveMinimum' || key === 'exclusiveMaximum') continue;
    output[key] = stripUnsupported(child);
  }
  if (input.exclusiveMinimum === true && typeof input.minimum === 'number') {
    output.exclusiveMinimum = input.minimum;
    delete output.minimum;
  } else if (typeof input.exclusiveMinimum === 'number') {
    output.exclusiveMinimum = input.exclusiveMinimum;
  }
  if (input.exclusiveMaximum === true && typeof input.maximum === 'number') {
    output.exclusiveMaximum = input.maximum;
    delete output.maximum;
  } else if (typeof input.exclusiveMaximum === 'number') {
    output.exclusiveMaximum = input.exclusiveMaximum;
  }
  if (hints.length) {
    const existing = typeof input.description === 'string' ? input.description.trim() : '';
    output.description = existing ? existing + '；' + hints.join('、') + '。' : hints.join('、') + '。';
  }
  return output;
}

/** Builds the response schema sent to Gemini from a Zod schema. */
export function toGeminiResponseSchema(schema: z.ZodType): Record<string, unknown> {
  return stripUnsupported(z.toJSONSchema(schema, { target: 'openapi-3.0' })) as Record<string, unknown>;
}
