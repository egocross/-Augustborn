/** All birth date/time fields use China Standard Time, never the caller's browser time zone. */
export const BAZI_TIME_ZONE = 'Asia/Shanghai' as const;

/**
 * A Gregorian birth date and optional wall-clock time in {@link BAZI_TIME_ZONE}.
 *
 * `birthDate` is `YYYY-MM-DD`; `birthTime` is `HH:MM`, or null when the user
 * does not know the exact time. `birthRegion` is optional free text that is only
 * used as context for the report. Callers must not convert values from another
 * time zone.
 */
export interface BaziInput {
  birthDate: string;
  birthTime: string | null;
  birthRegion?: string;
}

export interface BaziPillars {
  year: string;
  month: string;
  day: string;
  hour: string | null;
}

export type FiveElement = '木' | '火' | '土' | '金' | '水';

export type FiveElements = Record<FiveElement, number>;

export interface BaziChart {
  solarDate: string;
  birthRegion: string | null;
  timeKnown: boolean;
  pillars: BaziPillars;
  hourBranch: string | null;
  fiveElements: FiveElements;
}
