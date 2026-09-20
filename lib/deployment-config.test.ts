import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

it('deploys Vercel Functions in Tokyo for users in China', () => {
  const configPath = join(process.cwd(), 'vercel.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as { regions?: string[] };

  expect(config.regions).toEqual(['hnd1']);
});
