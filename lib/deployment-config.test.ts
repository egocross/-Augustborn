import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, it } from 'vitest';

it('deploys Vercel Functions in Tokyo for users in China', () => {
  const configPath = join(process.cwd(), 'vercel.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as { regions?: string[] };

  expect(config.regions).toEqual(['hnd1']);
});

it('documents the required deep-analysis environment variables', () => {
  const env = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
  expect(env).toContain('DEEP_REPORT_PRICE=¥29.90');
  expect(env).toContain('MOCK_PAYMENT_SECRET=');
  expect(env).toContain('MOCK_PAYMENT_OUTCOME=success');
  expect(env).toContain('PAYMENT_PROVIDER=mock');
  expect(env).toContain('DEEP_REPORT_AMOUNT=29.90');
  expect(env).toContain('PAYMENT_RECEIPT_SECRET=');
  expect(env).toContain('ALIPAY_APP_ID=');
  expect(env).toContain('ALIPAY_GATEWAY=');
  expect(env).toContain('ALIPAY_NOTIFY_URL=');
  expect(env).toContain('ALIPAY_RETURN_URL=');
  expect(env).toContain('REPORT_PROVIDER=gemini');
  expect(env).toContain('mock | alipay_sandbox | alipay');
});
