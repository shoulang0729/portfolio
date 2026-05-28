import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config.js
vi.mock('../src/config.js', () => ({
  WORKER_URL: 'https://worker.example.com',
}));

// Mock data-helpers.js
vi.mock('../src/data-helpers.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchForexRate } from '../src/forex.js';
import * as dataHelpers from '../src/data-helpers.js';

describe('forex.js', () => {
  let mockFetchWithTimeout;

  beforeEach(() => {
    mockFetchWithTimeout = vi.mocked(dataHelpers.fetchWithTimeout);
    mockFetchWithTimeout.mockClear();
  });

  describe('fetchForexRate', () => {
    it('正常系: レート取得成功', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ rate: 150.2 }),
      };
      mockFetchWithTimeout.mockResolvedValue(mockResponse);

      const rate = await fetchForexRate('USD', 'JPY');

      expect(rate).toBe(150.2);
      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        'https://worker.example.com/forex?from=USD&to=JPY',
        8000
      );
    });

    it('正常系: 通貨コード（日本語・特殊文字）の URL エンコード', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ rate: 100 }),
      };
      mockFetchWithTimeout.mockResolvedValue(mockResponse);

      await fetchForexRate('EUR', 'GBP');

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        'https://worker.example.com/forex?from=EUR&to=GBP',
        8000
      );
    });

    it('レスポンス OK が false の場合は null を返す', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({ error: 'Not found' }),
      };
      mockFetchWithTimeout.mockResolvedValue(mockResponse);

      const rate = await fetchForexRate('USD', 'XXX');

      expect(rate).toBeNull();
    });

    it('レスポンス body に rate がない場合は null を返す', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({}),
      };
      mockFetchWithTimeout.mockResolvedValue(mockResponse);

      const rate = await fetchForexRate('USD', 'JPY');

      expect(rate).toBeNull();
    });

    it('503 エラー（fetch 失敗）時に null を返す', async () => {
      mockFetchWithTimeout.mockRejectedValue(new Error('503 Service Unavailable'));

      const rate = await fetchForexRate('USD', 'JPY');

      expect(rate).toBeNull();
    });

    it('ネットワーク失敗時に null を返す', async () => {
      mockFetchWithTimeout.mockRejectedValue(new Error('Network error'));

      const rate = await fetchForexRate('USD', 'JPY');

      expect(rate).toBeNull();
    });

    it('タイムアウト失敗時に null を返す', async () => {
      mockFetchWithTimeout.mockRejectedValue(new Error('Timeout'));

      const rate = await fetchForexRate('USD', 'JPY');

      expect(rate).toBeNull();
    });
  });
});
