import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { generateContentStream, GoogleGenAI } = vi.hoisted(() => {
  const generateContentStream = vi.fn();
  const GoogleGenAI = vi.fn(function GoogleGenAI() {
    return { models: { generateContentStream } };
  });

  return { generateContentStream, GoogleGenAI };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI,
  ThinkingLevel: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
}));

import { generateReportStream } from './generate-report';

const chart = {
  solarDate: '1990-01-01',
  pillars: { year: '庚午', month: '戊子', day: '甲子', hour: '甲子' },
  hourBranch: '子',
  fiveElements: { 木: 2, 火: 1, 土: 2, 金: 1, 水: 2 },
};

const collect = async () => {
  const chunks: string[] = [];
  for await (const delta of generateReportStream(chart)) {
    chunks.push(delta);
  }
  return chunks.join('');
};

const streamOf = (chunks: Array<{ text?: string }>) =>
  (async function* generate() {
    for (const chunk of chunks) {
      yield chunk;
    }
  })();

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  generateContentStream.mockReset();
  GoogleGenAI.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('streams a structured high-thinking report from the official Gemini API', async () => {
  generateContentStream.mockResolvedValue(streamOf([{ text: '{"sections":' }, { text: '[]}' }]));

  await expect(collect()).resolves.toBe('{"sections":[]}');
  expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: undefined });
  expect(generateContentStream).toHaveBeenCalledWith(
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

it('fails when the stream produces no report text', async () => {
  generateContentStream.mockResolvedValue(streamOf([{ text: '' }]));

  await expect(collect()).rejects.toThrow('Gemini returned no report content.');
});
