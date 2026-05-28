import { describe, it, expect } from 'vitest';

function createStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}

globalThis.localStorage = createStorage();
globalThis.sessionStorage = createStorage();

const { AUTH_PIN_HASH, _hashPin } = await import('../src/auth-pin.js');

describe('AUTH_PIN_HASH', () => {
  it('is SHA-256 of "1234"', async () => {
    const expected = await _hashPin('1234');
    expect(AUTH_PIN_HASH).toBe(expected);
    expect(AUTH_PIN_HASH).toBe('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');
  });
});
