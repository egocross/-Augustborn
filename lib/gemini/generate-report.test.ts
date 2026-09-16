import { beforeEach, expect, it, vi } from 'vitest';

const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  ThinkingLevel: { HIGH: 'HIGH' },
}));

import { generateReport } from './generate-report';

const chart = {
  solarDate: '1990-01-01',
  pillars: { year: '庚午', month: '戊子', day: '甲子', hour: '甲子' },
  hourBranch: '子',
  fiveElements: { 木: 2, 火: 1, 土: 2, 金: 1, 水: 2 },
};

beforeEach(() => {
  generateContent.mockReset();
});

it('requests a structured HIGH-thinking Gemini report and parses the result', async () => {
  generateContent.mockResolvedValue({
    text: JSON.stringify({
      title: '报告',
      summary: '摘要',
      sections: [{ heading: '观察', body: '内容', bullets: [] }],
      disclaimer: '仅供参考',
    }),
  });

  await expect(generateReport(chart)).resolves.toMatchObject({ title: '报告' });
  expect(generateContent).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'gemini-3.1-pro-preview',
      config: expect.objectContaining({
        responseMimeType: 'application/json',
        responseJsonSchema: expect.objectContaining({ type: 'object' }),
        thinkingConfig: { thinkingLevel: 'HIGH' },
      }),
    }),
  );
});
