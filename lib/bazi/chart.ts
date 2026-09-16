import { Lunar } from 'lunar-typescript';
import type { BaziChart, BaziInput, BaziPillars, FiveElement, FiveElements } from './types';

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const ELEMENT_BY_PILLAR_CHARACTER: Readonly<Record<string, FiveElement>> = {
  甲: '木',
  乙: '木',
  丙: '火',
  丁: '火',
  戊: '土',
  己: '土',
  庚: '金',
  辛: '金',
  壬: '水',
  癸: '水',
  子: '水',
  丑: '土',
  寅: '木',
  卯: '木',
  辰: '土',
  巳: '火',
  午: '火',
  未: '土',
  申: '金',
  酉: '金',
  戌: '土',
  亥: '水',
};

export function hourBranch(hour: number) {
  return BRANCHES[Math.floor(((hour + 1) % 24) / 2)];
}

function hourPillar(dayPillar: string, hour: number) {
  const branch = hourBranch(hour);
  const dayStemIndex = STEMS.indexOf(dayPillar[0]);
  const branchIndex = BRANCHES.indexOf(branch);

  return `${STEMS[((dayStemIndex % 5) * 2 + branchIndex) % STEMS.length]}${branch}`;
}

function countElements(pillars: BaziPillars): FiveElements {
  const counts: FiveElements = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };

  for (const pillar of Object.values(pillars)) {
    for (const character of pillar) {
      const element = ELEMENT_BY_PILLAR_CHARACTER[character];
      if (element) {
        counts[element] += 1;
      }
    }
  }

  return counts;
}

export function createChart(input: BaziInput): BaziChart {
  const lunar = Lunar.fromYmdHms(
    input.lunarYear,
    input.lunarMonth,
    input.lunarDay,
    input.hour,
    input.minute,
    0,
  );
  const eightChar = lunar.getEightChar();
  eightChar.setSect(2);

  const day = eightChar.getDay();
  const pillars: BaziPillars = {
    year: eightChar.getYear(),
    month: eightChar.getMonth(),
    day,
    hour: hourPillar(day, input.hour),
  };

  return {
    solarDate: lunar.getSolar().toYmd(),
    pillars,
    hourBranch: hourBranch(input.hour),
    fiveElements: countElements(pillars),
  };
}
