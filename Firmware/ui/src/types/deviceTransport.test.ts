import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  effectiveTransport,
  getBleAvailability,
  isSafariBrowser,
  supportsWifiTransport,
} from './deviceTransport';

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
    vi.stubGlobal('window', {
      isSecureContext: true,
      location: { protocol: 'https:', hostname: 'connect.caznic.xyz' },
    });

    const result = getBleAvailability();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Safari does not support Web Bluetooth/i);
    expect(result.reason).not.toMatch(/WiFi/i);
  });

  it('suggests WiFi on Safari when self-hosted locally', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    });
    vi.stubGlobal('window', {
      isSecureContext: true,
      location: { protocol: 'http:', hostname: 'localhost' },
    });

    const result = getBleAvailability();
    expect(result.reason).toMatch(/WiFi/i);
  });
});

describe('supportsWifiTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('disables WiFi on static HTTPS hosts', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'https:', hostname: 'connect.caznic.xyz' },
    });
    expect(supportsWifiTransport()).toBe(false);
  });

  it('enables WiFi on localhost', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'http:', hostname: 'localhost' },
    });
    expect(supportsWifiTransport()).toBe(true);
  });
});

describe('effectiveTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('coerces wifi to ble when WiFi is unavailable', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'https:', hostname: 'connect.caznic.xyz' },
    });
    expect(effectiveTransport('wifi')).toBe('ble');
  });
});
