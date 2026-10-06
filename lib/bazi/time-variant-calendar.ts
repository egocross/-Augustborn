import { LunarUtil, Solar } from 'lunar-typescript';
import { z } from 'zod';
import { calculateChartFacts } from './chart';

export const CHART_ALGORITHM_VERSION = 'bazi-sect2-time-variants-v1';
// Pinned semantic dependency. A dependency upgrade requires review and a version bump.
export const CHART_LIBRARY_VERSION = 'lunar-typescript@1.8.6';

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const pillar = z.string().regex(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/)
  .refine(value => STEMS.indexOf(value[0]) % 2 === BRANCHES.indexOf(value[1]) % 2, 'invalid_pillar_parity');
const characterElements: Record<string, '木' | '火' | '土' | '金' | '水'> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};
export const CanonicalChartSchema = z.object({
  pillars: z.object({ year: pillar, month: pillar, day: pillar, hour: pillar.nullable() }).strict(),
  hourBranch: z.string().regex(/^[子丑寅卯辰巳午未申酉戌亥]$/).nullable(),
  timeKnown: z.boolean(),
  surfaceFiveElements: z.object({
    木: z.number().int().min(0).max(8), 火: z.number().int().min(0).max(8),
    土: z.number().int().min(0).max(8), 金: z.number().int().min(0).max(8), 水: z.number().int().min(0).max(8),
  }).strict(),
}).strict().superRefine((chart, ctx) => {
  if (chart.timeKnown !== (chart.pillars.hour !== null) || chart.hourBranch !== (chart.pillars.hour?.[1] ?? null)) {
    ctx.addIssue({ code: 'custom', message: 'hour_presence_mismatch' });
  }
  const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const character of Object.values(chart.pillars).join('')) {
    const element = characterElements[character];
    if (element) counts[element]++;
  }
  if (Object.keys(counts).some(key => counts[key as keyof typeof counts] !== chart.surfaceFiveElements[key as keyof typeof counts])) {
    ctx.addIssue({ code: 'custom', message: 'element_count_mismatch' });
  }
});
export type CanonicalChart = z.infer<typeof CanonicalChartSchema>;

/** Offsets are fixed standard-clock seconds, independent of the host timezone/DST. */
export function solarAtOffset(base: Solar, seconds: number): Solar {
  const date = base.nextDay(Math.floor(seconds / 86400));
  const withinDay = seconds % 86400;
  return Solar.fromYmdHms(date.getYear(), date.getMonth(), date.getDay(),
    Math.floor(withinDay / 3600), Math.floor(withinDay / 60) % 60, withinDay % 60);
}

export function standardClockTimestamp(base: Solar, seconds: number): string {
  return solarAtOffset(base, seconds).toYmdHms().replace(' ', 'T') + '+08:00';
}

/** Collect every year/month switching term from both days' complete library tables. */
export function solarTermOffsets(base: Solar, endDayOffset: number): number[] {
  const offsets = new Set<number>();
  for (let day = 0; day <= endDayOffset; day++) {
    const table = base.nextDay(day).getLunar().getJieQiTable();
    for (let index = 0; index < LunarUtil.JIE_QI_IN_USE.length; index++) {
      const term = table[LunarUtil.JIE_QI_IN_USE[index]];
      if (!term) throw new Error('incomplete_solar_term_table');
      // EightChar uses the even entries (节); includes 立春, not the intervening 气.
      if (index % 2 === 0) offsets.add(term.subtract(base) * 86400 + term.getHour() * 3600 + term.getMinute() * 60 + term.getSecond());
    }
  }
  return [...offsets].sort((a, b) => a - b);
}

export function canonicalChartAt(base: Solar, seconds: number, timeKnown: boolean): CanonicalChart {
  return CanonicalChartSchema.parse(calculateChartFacts(solarAtOffset(base, seconds).getLunar(), timeKnown));
}
