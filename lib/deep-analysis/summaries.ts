import type { BaziChart, BaziInput } from '@/lib/bazi/types';
import type { Report } from '@/lib/gemini/schema';

const clip = (value: string, limit: number) => value.trim().slice(0, limit);

export type BirthSummary = Pick<BaziChart, 'timeKnown' | 'pillars' | 'hourBranch' | 'surfaceFiveElements'>;

export function createBirthSummary(
  _input: BaziInput,
  chart: Pick<BaziChart, 'timeKnown' | 'pillars' | 'hourBranch' | 'surfaceFiveElements'>,
): BirthSummary {
  return {
    timeKnown: chart.timeKnown,
    pillars: chart.pillars,
    hourBranch: chart.hourBranch,
    surfaceFiveElements: chart.surfaceFiveElements,
  };
}

export function createFreeReportSummary(report: Report) {
  return {
    sections: report.sections.map((section) => ({
      heading: clip(section.heading, 100),
      summary: clip(section.body, 600),
      bullets: section.bullets.slice(0, 8).map((bullet) => clip(bullet, 240)),
    })),
  };
}
