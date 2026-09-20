import { describe, expect, it } from 'vitest';

import { createBirthSummary, createFreeReportSummary } from './summaries';

describe('deep analysis summaries', () => {
  it('does not include raw birth fields in the persistable summary', () => {
    const input = { birthDate: '1977-10-15', birthTime: '13:30', birthRegion: '杭州滨江' };
    const chart = {
      solarDate: input.birthDate,
      birthRegion: input.birthRegion,
      timeKnown: true,
      pillars: { year: '丁巳', month: '庚戌', day: '乙卯', hour: '癸未' },
      hourBranch: '未',
      fiveElements: { '木': 2, '火': 2, '土': 2, '金': 1, '水': 1 },
    } as const;

    const summary = createBirthSummary(input, chart);
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain(input.birthDate);
    expect(serialized).not.toContain(input.birthTime);
    expect(serialized).not.toContain(input.birthRegion);
    expect(summary.pillars.day).toBe('乙卯');
  });

  it('bounds free report prose while preserving section structure', () => {
    const summary = createFreeReportSummary({
      disclaimer: '只供参考',
      sections: [{ heading: '性格', body: '甲'.repeat(900), bullets: ['乙'.repeat(500)] }],
    });

    expect(summary.sections[0].summary.length).toBeLessThanOrEqual(600);
    expect(summary.sections[0].bullets[0].length).toBeLessThanOrEqual(240);
    expect(summary).not.toHaveProperty('disclaimer');
  });
});
