const browserOrigin = (value: string | null | undefined) => {
  const origin = value?.trim();
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
};

/**
 * Alipay redirects the payer's browser to `return_url`, so the return leg only
 * has to be reachable from that browser. Preferring the origin that created the
 * checkout keeps the pending session in the same tab and origin it was started
 * from, which is what the deep report needs after payment.
 */
export function resolveBrowserReturnUrl(
  origin: string | null | undefined,
  fallback: string,
  path = '/explore',
): string {
  const resolved = browserOrigin(origin);
  return resolved ? new URL(path, resolved).toString() : fallback;
}
