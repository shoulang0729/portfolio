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
  it('is SHA-256 of "123456"', async () => {
    const expected = await _hashPin('123456');
    expect(AUTH_PIN_HASH).toBe(expected);
    expect(AUTH_PIN_HASH).toBe('8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92');
  });
});
