import { describe, expect, it, vi, afterEach } from 'vitest';
import { getBleAvailability, isSafariBrowser } from './deviceTransport';

describe('isSafariBrowser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects Safari', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    expect(isSafariBrowser()).toBe(true);
  });

  it('does not treat Chrome as Safari', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    expect(isSafariBrowser()).toBe(false);
  });
});

describe('getBleAvailability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('explains Safari lacks Web Bluetooth', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    vi.stubGlobal('window', { isSecureContext: true });

    const result = getBleAvailability();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Safari does not support Web Bluetooth/i);
    expect(result.reason).toMatch(/WiFi/i);
  });
});
