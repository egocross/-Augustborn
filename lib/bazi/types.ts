/** All BaZi date/time fields use China Standard Time, never the caller's browser time zone. */
export const BAZI_TIME_ZONE = 'Asia/Shanghai' as const;

/**
 * A lunar birth date and wall-clock time in {@link BAZI_TIME_ZONE}.
 *
 * `hour` and `minute` must be the local China Standard Time supplied by the user;
 * callers must not convert them from the browser or another time zone.
 */
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
