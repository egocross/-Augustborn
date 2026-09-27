/** All birth date/time fields use China Standard Time, never the caller's browser time zone. */
export const BAZI_TIME_ZONE = 'Asia/Shanghai' as const;

/** Which calendar the user entered their birth date in. */
export type CalendarType = 'solar' | 'lunar';

/**
 * A birth date, its calendar, and an optional wall-clock time in {@link BAZI_TIME_ZONE}.
 *
 * `birthDate` is always `YYYY-MM-DD`. In solar mode the month is 1–12 (Gregorian);
 * in lunar mode it is the lunar month 1–12 and `isLeapMonth` marks a leap month.
 * `birthTime` is `HH:MM`, or null when the user does not know the exact time.
 * `birthRegion` is optional free text used only as context for the report.
 */
export interface BaziInput {
  birthDate: string;
  birthTime: string | null;
  birthRegion?: string;
  calendarType: CalendarType;
  isLeapMonth?: boolean;
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
  inputCalendarType: CalendarType;
  inputBirthDate: string;
  isLeapMonth: boolean;
  solarDate: string;
  lunarDate: string;
  birthRegion: string | null;
  timeKnown: boolean;
  pillars: BaziPillars;
  hourBranch: string | null;
  surfaceFiveElements: FiveElements;
}
