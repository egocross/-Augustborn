import { z } from 'zod';
import { SolarUtil } from 'lunar-typescript';

const birthDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const birthTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const analysisSchema = z
  .object({
    birthDate: z.string().regex(birthDatePattern),
    birthTime: z.string().regex(birthTimePattern).nullable(),
    birthRegion: z.string().trim().max(40).optional().default(''),
  })
  .strict()
  .superRefine(({ birthDate }, context) => {
    const [year, month, day] = birthDate.split('-').map(Number);

    if (year < 1900 || year > 2100) {
      context.addIssue({
        code: 'custom',
        message: 'Birth year outside the supported range.',
        path: ['birthDate'],
      });
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

export const feedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    wantsDeepAnalysis: z.boolean(),
  })
  .strict();
