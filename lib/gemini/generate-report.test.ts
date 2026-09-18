import { beforeEach, expect, it, vi } from 'vitest';

const { create, OpenAI } = vi.hoisted(() => {
  const create = vi.fn();
  const OpenAI = vi.fn(function OpenAI() {
    return { chat: { completions: { create } } };
  });

  return { create, OpenAI };
});

vi.mock('openai', () => ({ default: OpenAI }));

import { generateReport } from './generate-report';

const chart = {
  solarDate: '1990-01-01',
  pillars: { year: '庚午', month: '戊子', day: '甲子', hour: '甲子' },
  hourBranch: '子',
  fiveElements: { 木: 2, 火: 1, 土: 2, 金: 1, 水: 2 },
};

beforeEach(() => {
  create.mockReset();
  OpenAI.mockClear();
});

it('requests a Kie structured high-reasoning report and parses the result', async () => {
  create.mockResolvedValue({
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 0,
    model: 'gemini-3.1-pro-openai',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: JSON.stringify({
            sections: [{ heading: '观察', body: '内容', bullets: [] }],
            disclaimer: '仅供参考',
          }),
        },
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });

  await expect(generateReport(chart)).resolves.toMatchObject({ disclaimer: '仅供参考' });
  expect(OpenAI).toHaveBeenCalledWith({
    apiKey: undefined,
    baseURL: 'https://api.kie.ai/gemini-3.1-pro/v1',
  });
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'gemini-3.1-pro-openai',
      messages: [
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('人生是一系列决策'),
        }),
      ],
      reasoning_effort: 'high',
      response_format: expect.objectContaining({
        type: 'json_schema',
        json_schema: expect.objectContaining({
          name: 'bazi_report',
          strict: true,
          schema: expect.objectContaining({ type: 'object' }),
        }),
      }),
    }),
  );
});
