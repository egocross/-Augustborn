export interface BaziInput {
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  hour: number;
  minute: number;
}

export interface BaziPillars {
  year: string;
  month: string;
  day: string;
  hour: string;
}

export type FiveElement = '木' | '火' | '土' | '金' | '水';

export type FiveElements = Record<FiveElement, number>;

export interface BaziChart {
  solarDate: string;
  pillars: BaziPillars;
  hourBranch: string;
  fiveElements: FiveElements;
}
