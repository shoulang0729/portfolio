#!/bin/bash
set -euo pipefail

cd "$CLAUDE_PROJECT_DIR"

echo "=== Session Start Hook ==="

# 1. 最新コードを取得（ff-only: コンフリクト時は無視して進む）
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
echo "Branch: $CURRENT_BRANCH"
if git pull origin "$CURRENT_BRANCH" --ff-only 2>/dev/null; then
  echo "✓ git pull OK"
else
  echo "! git pull skipped (local changes or diverged branch)"
fi

# 2. npm 依存関係を同期（package.json 更新に追従）
echo "Installing npm dependencies..."
npm install
echo "✓ npm install OK"

# --- 以下は web (リモート) 環境のみ ---
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  echo "=== Session Start Done (local) ==="
  exit 0
fi

# 3. dist/app.js を最新ソースからビルド（web では node_modules が毎回リセットされるため）
echo "Building dist/app.js..."
npm run build
echo "✓ build OK"

# 4. Playwright ブラウザをインストール（E2E テスト用、失敗は無視）
echo "Installing Playwright Chromium..."
npx playwright install chromium 2>/dev/null && echo "✓ Playwright OK" \
  || echo "! Playwright install skipped (network restriction)"

echo "=== Session Start Done (web) ==="
