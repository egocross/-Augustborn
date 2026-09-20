import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCustomQuestionsHandler } from './route';

const generateCustomQuestions = vi.fn();

const request = (body: unknown) => new Request('http://localhost/api/deep-analysis/custom-questions', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

const valid = { sessionId: 'session-12345678', customQuestion: '我要不要转岗？', freeReportSummary: { sections: [] } };

beforeEach(() => generateCustomQuestions.mockReset());

describe('POST /api/deep-analysis/custom-questions', () => {
  it('returns validated questions', async () => {
    generateCustomQuestions.mockResolvedValue([]);
    const POST = createCustomQuestionsHandler(generateCustomQuestions);
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ questions: [] });
  });

  it('returns parse_failed for malformed model output without echoing it', async () => {
    const failingGenerator = async () => {
      throw Object.assign(new Error('malformed payload must not be exposed'), { code: 'parse_failed' });
    };
    const POST = createCustomQuestionsHandler(failingGenerator);
    const response = await POST(request(valid));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: 'parse_failed', error: expect.any(String) });
  });

  it('rejects oversized custom questions before calling Gemini', async () => {
    const POST = createCustomQuestionsHandler(generateCustomQuestions);
    const response = await POST(request({ ...valid, customQuestion: '甲'.repeat(1001) }));
    expect(response.status).toBe(400);
    expect(generateCustomQuestions).not.toHaveBeenCalled();
  });
});
