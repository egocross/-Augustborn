import { describe, expect, it } from 'vitest';

import { resolveBrowserReturnUrl } from './public-url';

const fallback = 'https://jianvia.com/explore';

describe('resolveBrowserReturnUrl', () => {
  it('keeps the payer on the origin that created the checkout', () => {
    expect(resolveBrowserReturnUrl('http://localhost:3000', fallback)).toBe('http://localhost:3000/explore');
    expect(resolveBrowserReturnUrl('https://preview.example.com', fallback)).toBe('https://preview.example.com/explore');
  });

  it('drops path, credentials and query from the reported origin', () => {
    expect(resolveBrowserReturnUrl('https://preview.example.com/some/page?x=1', fallback)).toBe('https://preview.example.com/explore');
    expect(resolveBrowserReturnUrl('https://user:pass@preview.example.com', fallback)).toBe(fallback);
  });

  it('falls back when the origin is missing or not browser reachable', () => {
    expect(resolveBrowserReturnUrl(null, fallback)).toBe(fallback);
    expect(resolveBrowserReturnUrl('', fallback)).toBe(fallback);
    expect(resolveBrowserReturnUrl('not a url', fallback)).toBe(fallback);
    expect(resolveBrowserReturnUrl('ftp://example.com', fallback)).toBe(fallback);
  });
});
