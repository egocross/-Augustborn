import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { streamBaseReport } = vi.hoisted(() => ({ streamBaseReport: vi.fn() }));
vi.mock('@/lib/report-provider', () => ({ streamBaseReport }));

import { POST } from './route';

const request = () => new Request('http://localhost/api/analyze', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    birthDate: '1987-09-25', birthTime: '13:30', birthRegion: '杭州',
    calendarType: 'solar', isLeapMonth: false,
  }),
});

const report = {
  sections: [{ heading: '核心结构', body: '正文', bullets: ['要点'] }],
  disclaimer: '仅供参考。',
};

beforeEach(() => {
  process.env.MOCK_PAYMENT_SECRET = 'route-snapshot-secret';
  streamBaseReport.mockReset();
});

afterEach(() => {
  delete process.env.MOCK_PAYMENT_SECRET;
});

describe('/api/analyze signed report event', () => {
  it('emits an opaque snapshot token only with a valid completed report', async () => {
    streamBaseReport.mockImplementation(async function* () {
      yield JSON.stringify(report);
    });

    const response = await POST(request());
    const body = await response.text();
    const events = body.trim().split('\n\n').map((chunk) => JSON.parse(chunk.replace(/^data:\s*/, '')));
    const completed = events.find((event) => event.type === 'report');

    expect(completed.report).toEqual(report);
    expect(completed.snapshotToken).toMatch(/^v1\./);
  });

  it('does not emit a report token when generated content is invalid', async () => {
    streamBaseReport.mockImplementation(async function* () {
      yield JSON.stringify({ sections: [], disclaimer: '' });
    });

    const response = await POST(request());
    const body = await response.text();

    expect(body).not.toContain('snapshotToken');
    expect(body).toContain('"type":"error"');
  });
});
