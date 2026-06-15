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

const { _getActivePinHash, _hashPin } = await import('../src/auth-pin.js');

describe('PIN default', () => {
  it('does not fall back to a hard-coded default PIN hash', async () => {
    expect(_getActivePinHash()).toBeNull();
    const oldDefault = await _hashPin('123456');
    expect(oldDefault).toBe('8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92');
  });
});
