import { errRes } from './http.js';

// ══════════════════════════════════════════════════════════════
// POST /portfolio/snapshot — 無効化済み（#709）
//   未使用の書き込み経路として停止。GitHub への push・KV からの組み立ては行わない。
//   どのメソッドでも 410 Gone（CORS 付き）を返す。
// ══════════════════════════════════════════════════════════════
export function handlePortfolioSnapshot(origin) {
  return errRes('スナップショット保存は無効化されました', 410, origin);
}

// ══════════════════════════════════════════════════════════════
// 無効化済みルート（#714）
//   AI タブ（#723 で src/_disabled/ ごと削除）専用だったルート。
//   /ai/gemini・/ai/grok・/ai/deepseek・/ai/claude・/ai/models・/ai/context・/notion/save
//   /ai/openai はマネフォ画像取込（アプリから削除）専用だったため #718 で追加。
//   どのメソッドでも 410 Gone（CORS 付き）を返す。外部 fetch・KV には触れない。
// ══════════════════════════════════════════════════════════════
export const DISABLED_PATHS = new Set([
  '/ai/gemini',
  '/ai/grok',
  '/ai/deepseek',
  '/ai/claude',
  '/ai/models',
  '/ai/context',
  '/notion/save',
  '/ai/openai',
]);

export function handleDisabledRoute(origin) {
  return errRes('このルートは無効化されました', 410, origin);
}
