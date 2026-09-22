import 'server-only';

import { AlipaySdk } from 'alipay-sdk';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createAlipayPaymentProvider } from './alipay';
import { createPaymentCoordinator, type PaymentProviderId } from './payment-orders';
import { createSupabasePaymentOrderRepository } from './payment-repository';
import { resolveBrowserReturnUrl } from './public-url';

const GATEWAYS: Record<PaymentProviderId, string> = {
  alipay: 'https://openapi.alipay.com/gateway.do',
  alipay_sandbox: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
};

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
};

const restoreMultilineSecret = (value: string) => value.replaceAll('\\n', '\n');

const validAmount = (value: string) => {
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(value)) throw new Error('invalid_deep_report_amount');
  return Number(value).toFixed(2);
};

const publicHttpsUrl = (name: string, fallbackPath: string) => {
  const configured = process.env[name]?.trim();
  const value = configured || `${required('APP_URL').replace(/\/$/, '')}${fallbackPath}`;
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`invalid_${name.toLowerCase()}`);
  return url.toString();
};

/**
 * `PAYMENT_PROVIDER=alipay` targets the live Alipay gateway and requires a
 * published app with the WAP payment product enabled and its own keys;
 * `alipay_sandbox` keeps the test environment.
 */
export function getPaymentCoordinator(options: { browserOrigin?: string | null } = {}) {
  const client = getSupabaseAdmin();
  if (!client) throw new Error('missing_supabase_payment_storage');

  const providerId: PaymentProviderId = process.env.PAYMENT_PROVIDER?.trim().toLowerCase() === 'alipay'
    ? 'alipay'
    : 'alipay_sandbox';
  const appId = required('ALIPAY_APP_ID');
  const gateway = new AlipaySdk({
    appId,
    privateKey: restoreMultilineSecret(required('ALIPAY_PRIVATE_KEY')),
    alipayPublicKey: restoreMultilineSecret(required('ALIPAY_PUBLIC_KEY')),
    gateway: process.env.ALIPAY_GATEWAY?.trim() || GATEWAYS[providerId],
    keyType: process.env.ALIPAY_KEY_TYPE?.trim().toUpperCase() === 'PKCS1' ? 'PKCS1' : 'PKCS8',
    signType: 'RSA2',
  });

  const provider = createAlipayPaymentProvider({
    appId,
    sellerId: required('ALIPAY_SELLER_ID'),
    notifyUrl: publicHttpsUrl('ALIPAY_NOTIFY_URL', '/api/deep-analysis/payment/notify'),
    returnUrl: resolveBrowserReturnUrl(
      options.browserOrigin,
      publicHttpsUrl('ALIPAY_RETURN_URL', '/explore'),
    ),
    gateway,
  });

  return createPaymentCoordinator({
    repository: createSupabasePaymentOrderRepository(client),
    provider,
    providerId,
    amount: validAmount(process.env.DEEP_REPORT_AMOUNT?.trim() || '29.90'),
    receiptSecret: process.env.PAYMENT_RECEIPT_SECRET?.trim() || required('MOCK_PAYMENT_SECRET'),
  });
}
