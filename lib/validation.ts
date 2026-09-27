import { z } from 'zod';
import { LunarMonth, SolarUtil } from 'lunar-typescript';

const birthDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const birthTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const analysisSchema = z
  .object({
    birthDate: z.string().regex(birthDatePattern),
    birthTime: z.string().regex(birthTimePattern).nullable(),
    birthRegion: z.string().trim().max(40).optional().default(''),
    calendarType: z.enum(['solar', 'lunar']).optional().default('solar'),
    isLeapMonth: z.boolean().optional().default(false),
  })
  .strict()
  .superRefine((input, context) => {
    const [year, month, day] = input.birthDate.split('-').map(Number);

    if (year < 1900 || year > 2100) {
      context.addIssue({
        code: 'custom',
        message: 'Birth year outside the supported range.',
        path: ['birthDate'],
      });
      return;
    }

    if (input.calendarType === 'lunar') {
      if (month < 1 || month > 12 || day < 1 || day > 30) {
        context.addIssue({ code: 'custom', message: 'Invalid lunar birth date.', path: ['birthDate'] });
        return;
      }

      const lunarMonth = LunarMonth.fromYm(year, input.isLeapMonth ? -month : month);
      if (!lunarMonth || day > lunarMonth.getDayCount()) {
        context.addIssue({ code: 'custom', message: 'Invalid lunar birth date.', path: ['birthDate'] });
      }
      return;
    }

    const validMonth = month >= 1 && month <= 12;
    const daysInMonth = validMonth ? SolarUtil.getDaysOfMonth(year, month) : 0;

    if (!validMonth || day < 1 || day > daysInMonth) {
      context.addIssue({
        code: 'custom',
        message: 'Invalid birth date.',
        path: ['birthDate'],
      });
    }
  });

export type BirthInput = z.infer<typeof analysisSchema>;

export const feedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
  })
  .strict();
