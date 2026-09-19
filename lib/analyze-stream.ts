import type { Report, ReportSection } from '@/lib/gemini/schema';

export type AnalyzeStreamEvent =
  | { type: 'status'; stage: 'thinking' | 'writing' }
  | { type: 'delta'; text: string }
  | { type: 'report'; report: Report }
  | { type: 'error'; message: string };

export type AnalyzeStreamHandlers = {
  onStatus?: (stage: 'thinking' | 'writing') => void;
  onDelta?: (text: string) => void;
};

const isSection = (value: unknown): value is ReportSection => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const section = value as Partial<ReportSection>;
  return (
    typeof section.heading === 'string' &&
    typeof section.body === 'string' &&
    Array.isArray(section.bullets) &&
    section.bullets.every((bullet) => typeof bullet === 'string')
  );
};

/**
 * Pulls every section that has finished arriving out of a partially streamed
 * report JSON, so the page can render sections while the rest is still being
 * generated.
 */
export const extractCompleteSections = (partialJson: string): ReportSection[] => {
  const keyIndex = partialJson.indexOf('"sections"');
  if (keyIndex === -1) {
    return [];
  }

  const arrayStart = partialJson.indexOf('[', keyIndex);
  if (arrayStart === -1) {
    return [];
  }

  const sections: ReportSection[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escaped = false;

  for (let index = arrayStart + 1; index < partialJson.length; index += 1) {
    const char = partialJson[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        objectStart = index;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0 && objectStart !== -1) {
        try {
          const parsed: unknown = JSON.parse(partialJson.slice(objectStart, index + 1));
          if (isSection(parsed)) {
            sections.push(parsed);
          }
        } catch {
          // Section is not valid JSON yet; the next delta may complete it.
        }
        objectStart = -1;
      }
      continue;
    }

    if (char === ']' && depth === 0) {
      break;
    }
  }

  return sections;
};

const parseEvent = (raw: string): AnalyzeStreamEvent | null => {
  const line = raw.split('\n').find((entry) => entry.startsWith('data:'));
  if (!line) {
    return null;
  }

  try {
    return JSON.parse(line.slice('data:'.length).trim()) as AnalyzeStreamEvent;
  } catch {
    return null;
  }
};

/** Reads the analyze SSE stream and resolves with the finished report. */
export const consumeAnalyzeStream = async (
  body: ReadableStream<Uint8Array>,
  handlers: AnalyzeStreamHandlers = {},
): Promise<Report> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  let report: Report | null = null;
  let failure: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffered += decoder.decode(value, { stream: true });

    let separator = buffered.indexOf('\n\n');
    while (separator !== -1) {
      const event = parseEvent(buffered.slice(0, separator));
      buffered = buffered.slice(separator + 2);
      separator = buffered.indexOf('\n\n');

      if (!event) {
        continue;
      }

      if (event.type === 'status') {
        handlers.onStatus?.(event.stage);
      } else if (event.type === 'delta') {
        handlers.onDelta?.(event.text);
      } else if (event.type === 'report') {
        report = event.report;
      } else {
        failure = event.message;
      }
    }
  }

  if (report) {
    return report;
  }

  throw new Error(failure ?? '分析暂时不可用，请稍后重试。');
};
