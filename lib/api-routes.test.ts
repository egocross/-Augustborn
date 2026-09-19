import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createChart, generateReportStream, getSupabaseAdmin, from, insert } = vi.hoisted(() => ({
  createChart: vi.fn(),
  generateReportStream: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('@/lib/bazi/chart', () => ({ createChart }));
vi.mock('@/lib/gemini/generate-report', () => ({ generateReportStream }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin }));

import { POST as analyze } from '../app/api/analyze/route';
import { POST as feedback } from '../app/api/feedback/route';

const validAnalysis = { lunarYear: 1977, lunarMonth: 9, lunarDay: 3, hour: 13, minute: 30 };
const report = {
  sections: [{ heading: '观察', body: '内容', bullets: [] }],
  disclaimer: '仅供参考',
};

const jsonRequest = (url: string, body: unknown) =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  createChart.mockReset();
  generateReportStream.mockReset();
  getSupabaseAdmin.mockReset();
  from.mockReset();
  insert.mockReset();
  from.mockReturnValue({ insert });
});

describe('/api/analyze', () => {
  it('validates the body before calculating a chart', async () => {
    const response = await analyze(jsonRequest('http://localhost/api/analyze', { ...validAnalysis, hour: 24 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(createChart).not.toHaveBeenCalled();
    expect(generateReportStream).not.toHaveBeenCalled();
  });

  it('rejects an impossible lunar date before calculating a chart', async () => {
    const response = await analyze(
      jsonRequest('http://localhost/api/analyze', { ...validAnalysis, lunarYear: 2025, lunarMonth: 2, lunarDay: 30 }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(createChart).not.toHaveBeenCalled();
    expect(generateReportStream).not.toHaveBeenCalled();
  });

  it('creates a chart then streams its generated report', async () => {
    const chart = { pillars: {} };
    createChart.mockReturnValue(chart);
    generateReportStream.mockImplementation(async function* generate() {
      yield JSON.stringify(report);
    });

    const response = await analyze(jsonRequest('http://localhost/api/analyze', validAnalysis));

    expect(response.status).toBe(200);
    expect(createChart).toHaveBeenCalledWith(validAnalysis);
    expect(generateReportStream).toHaveBeenCalledWith(chart);

    const events = (await response.text())
      .split('\n\n')
      .filter((chunk) => chunk.length > 0)
      .map((chunk) => JSON.parse(chunk.replace('data: ', '')));

    expect(events[0]).toEqual({ type: 'status', stage: 'thinking' });
    expect(events.at(-1)).toEqual({ type: 'report', report });
  });
});

describe('/api/feedback', () => {
  it('inserts only the two approved feedback fields', async () => {
    getSupabaseAdmin.mockReturnValue({ from });
    insert.mockResolvedValue({ error: null });

    const response = await feedback(
      jsonRequest('http://localhost/api/feedback', { rating: 4, wantsDeepAnalysis: true }),
    );

    expect(response.status).toBe(204);
    expect(from).toHaveBeenCalledWith('feedback');
    expect(insert).toHaveBeenCalledWith({ rating: 4, wants_deep_analysis: true });
  });

  it('does not access Supabase for invalid feedback', async () => {
    const response = await feedback(
      jsonRequest('http://localhost/api/feedback', { rating: 0, wantsDeepAnalysis: false }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it('returns a configuration error when Supabase credentials are unavailable', async () => {
    getSupabaseAdmin.mockReturnValue(null);

    const response = await feedback(
      jsonRequest('http://localhost/api/feedback', { rating: 5, wantsDeepAnalysis: false }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });

  it('returns a safe error when Supabase rejects an insert', async () => {
    getSupabaseAdmin.mockReturnValue({ from });
    insert.mockRejectedValue(new Error('connection details must not reach the client'));

    const response = await feedback(
      jsonRequest('http://localhost/api/feedback', { rating: 5, wantsDeepAnalysis: false }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });
});
