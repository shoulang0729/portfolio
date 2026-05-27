# 開発セットアップ

## 必要なもの

- Node.js 20+
- Cloudflare アカウント（Worker・KV 用）
- Finnhub API キー（無料枠: 60 req/分）

---

## ローカルセットアップ

```bash
git clone https://github.com/shoulang0729/portfolio.git
cd portfolio
npm install
```

---

## テスト

```bash
npm test              # vitest 単体テスト（CI 相当）
npm run test:watch    # ウォッチモード
npm run test:spec     # docs/SPEC.md 整合性検証（CI 非対象）
```

---

## リント・フォーマット

```bash
npm run lint          # ESLint（src/ / worker/src/）
npm run lint:fix      # 自動修正
npm run format        # Prettier 整形
```

---

## デプロイ（GitHub Pages）

1. `index.html` の `?v=YYYYMMDDX` を全置換で更新（例: `20260527A`）
2. `sw.js` の `const CACHE = 'portfolio-vYYYYMMDDX'` を同じ値に更新
3. `git commit && git push` → GitHub Pages に自動反映

バージョン命名規則: 同日複数リリース時は `a, b, c … z → A, B, C …` と順に振る。

---

## Worker デプロイ

```bash
cd worker
npx wrangler deploy
```

Secrets の設定（初回のみ）:
```bash
npx wrangler secret put FINNHUB_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
# ... 他のキー
```

---

## 保有銘柄の更新

`src/positions.js` の `positions` 配列を編集するだけ。他のファイルは不要。

```js
// src/positions.js
export const positions = [
  { symbol: 'AAPL',   name: 'Apple',   shares: 10, avgCost: 150, cur: 'USD', cat: '米国株' },
  { symbol: '7203.T', name: 'トヨタ',  shares: 100, avgCost: 2000, cur: 'JPY', cat: '国内株' },
  // ...
];
```

---

## Claude Code との連携

このリポジトリは Claude Code（AI）が毎日自動で open issues を処理します。  
詳細は `.github/workflows/daily-issues.yml` を参照してください。

- **Wait** ラベルの issue は自動処理の対象外になります
- 実装された修正は `auto-fix/YYYYMMDD` ブランチに PR として作成されます
