import { beforeEach, describe, expect, it, vi } from 'vitest';

function createStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    clear: () => data.clear(),
  };
}

globalThis.localStorage = createStorage();
globalThis.sessionStorage = createStorage();

const authPin = await import('../src/auth-pin.js');

describe('PIN lockout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    authPin._auth.fails = 0;
    authPin._auth.lockedAt = null;
  });

  it('uses a five-minute lockout', () => {
    expect(authPin.AUTH_LOCK_SEC).toBe(300);
  });

  it('formats lockout durations in minutes and seconds', () => {
    expect(authPin._formatLockRemain(300)).toBe('5分');
    expect(authPin._formatLockRemain(299)).toBe('4分59秒');
    expect(authPin._formatLockRemain(30)).toBe('30秒');
  });

  it('keeps authentication locked during the five-minute window', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    authPin._auth.lockedAt = 1_000_000 - 299_000;

    expect(authPin._isLocked()).toBe(true);
    expect(authPin._lockRemain()).toBe(1);
  });
});
