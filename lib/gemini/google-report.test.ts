import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { generateContent, GoogleGenAI } = vi.hoisted(() => {
  const generateContent = vi.fn();
  const GoogleGenAI = vi.fn(function GoogleGenAI() {
    return { models: { generateContent } };
  });

  return { generateContent, GoogleGenAI };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI,
  ThinkingLevel: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
}));

import { generateReportWithGoogle } from './google-report';

const chart = {
  solarDate: '1990-01-01',
  pillars: { year: '庚午', month: '戊子', day: '甲子', hour: '甲子' },
  hourBranch: '子',
  fiveElements: { 木: 2, 火: 1, 土: 2, 金: 1, 水: 2 },
};

const reportPayload = {
  sections: [{ heading: '观察', body: '内容', bullets: [] }],
  disclaimer: '仅供参考',
};

beforeEach(() => {
  generateContent.mockReset();
  GoogleGenAI.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('requests a structured high-thinking report from the official Gemini API', async () => {
  generateContent.mockResolvedValue({ text: JSON.stringify(reportPayload) });

  await expect(generateReportWithGoogle(chart)).resolves.toMatchObject({ disclaimer: '仅供参考' });
  expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: undefined });
  expect(generateContent).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'gemini-3.1-pro-preview',
      contents: expect.stringContaining('人生是一系列决策'),
      config: expect.objectContaining({
        responseMimeType: 'application/json',
        responseJsonSchema: expect.objectContaining({ type: 'object' }),
        thinkingConfig: { thinkingLevel: 'HIGH' },
      }),
    }),
  );
});

it('retries once when the official API returns no text', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  generateContent
    .mockResolvedValueOnce({ text: undefined })
    .mockResolvedValueOnce({ text: JSON.stringify(reportPayload) });

  await expect(generateReportWithGoogle(chart)).resolves.toMatchObject({ disclaimer: '仅供参考' });
  expect(generateContent).toHaveBeenCalledTimes(2);
});
