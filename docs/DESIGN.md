# フロントエンド設計規約 / Design System

> このドキュメントは portfolio アプリで確立した設計ルールをまとめたものです。
> 他のアプリへの流用・引き継ぎが可能なよう、アプリ固有の内容と汎用ルールを分けて記述します。

---

## 1. カラーシステム

### CSS 変数（必須トークン）

```css
:root {
  /* 背景レイヤー（暗い順） */
  --bg        背景最底層（ページ全体）
  --surface   カード・パネルの背景
  --surface2  ネストされたカード・インプット背景
  --surface3  ホバー・アクティブ state

  /* ボーダー */
  --border    主要ボーダー
  --border2   サブ・セパレーター

  /* テキスト */
  --text      プライマリテキスト
  --text2     セカンダリ / プレースホルダー
  --text3     ディセーブル / 薄いラベル

  /* その他 */
  --shadow    ボックスシャドウ値（full shorthand）
  --shadow2   オーバーレイ背景色
  --accent    アクセントカラー（#cc785c = Claude ブラウン）
}
```

### 現在のパレット（Claude Desktop 準拠・ウォームトーン）

| トークン | ライト | ダーク |
|---|---|---|
| `--bg` | `#f7f2ee` | `#1c1917` |
| `--surface` | `#ffffff` | `#27211e` |
| `--surface2` | `#f0e9e3` | `#322b28` |
| `--surface3` | `#e8ddd7` | `#3d3530` |
| `--border` | `#d4c8c0` | `#48403b` |
| `--text` | `#1c1714` | `#f5f0ec` |
| `--text2` | `#78695f` | `#a09188` |
| `--accent` | `#cc785c` | `#cc785c` |

### ルール
- **色は必ず変数で指定する**。ハードコードした hex は NG（例外: アクセントカラーとモデルブランドカラー）
- ライト/ダークの両モード で視認性を確認すること（コントラスト比 4.5:1 以上）
- `auto` モードは JS の `matchMedia` で解決し、`data-theme` 属性に `dark`/`light` を明示セット

---

## 2. タイポグラフィ

```
フォントスタック:
  -apple-system, BlinkMacSystemFont, 'SF Pro Text',
  'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic',
  Arial, sans-serif

サイズスケール（推奨）:
  10px  ラベル・バッジ（uppercase + letter-spacing）
  11px  キャプション・サブテキスト
  12px  ステータス・タグ
  13px  本文・ボタン・インプット（基本）
  14px  AI 入力・本文大
  15px  セクションタイトル
  20px  ページタイトル

ウェイト:
  400   通常本文
  500   メニュー・タブ
  600   ボタン・強調
  700   見出し・カード名

letter-spacing:
  ラベル（10-11px uppercase）: 0.04-0.06em
  通常テキスト: デフォルト（0）
```

---

## 3. スペーシング

```
基本単位: 4px（0.25rem）

コンポーネント内パディング:
  xs:  4-6px   ピル・バッジ
  sm:  8-10px  ボタン・タグ
  md:  12-14px カード・パネル
  lg:  16-20px ページ余白

ギャップ:
  インラインアイテム:  4-8px
  カードグリッド:     10-12px
  セクション間:       12-16px

border-radius:
  0       面取りなし（インラインフォームなど）
  4px     小さいバッジ
  6-8px   ボタン・入力フィールド
  10-12px カード・パネル
  20px+   ピル・送信ボタン
  50%     アバター・丸ボタン
```

---

## 4. コンポーネントパターン

### ボタン

```css
/* プライマリ（送信・実行） */
.btn-primary {
  background: var(--text);
  color: var(--bg);
  border: none;
  border-radius: 20px;   /* ピル型 */
  padding: 7px 16px;
  font-size: 13px; font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
}
.btn-primary:hover   { opacity: 0.85; }
.btn-primary:active  { transform: scale(0.96); }
.btn-primary:disabled { opacity: 0.4; cursor: default; transform: none; }

/* セカンダリ（アウトライン） */
.btn-secondary {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text2);
  padding: 5px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.btn-secondary:hover { background: var(--surface2); color: var(--text); }
```

### カード

```css
.card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 10-12px;
  padding: 10px 12px;
  /* overflow: hidden（ヘッダーカラーを角丸にclipする場合） */
}
```

### インプット・テキストエリア

```css
/* インラインフォーム（面取りなし） */
.input-inline {
  background: var(--surface3);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 9px 10px;
  font-size: 13px; color: var(--text);
}
.input-inline:focus { border-color: var(--accent); outline: none; }

/* モーダル・カード内フォーム */
.input-card {
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 14px;
  padding: 14px 16px;
}
```

### タブバー

```css
.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--border);
}
.tab-btn {
  flex: 1;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;   /* tab-bar の下線と重ねる */
  color: var(--text2);
  font-size: 13px; font-weight: 500;
  cursor: pointer;
}
.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}
```

### セグメントスイッチ（ラジオ的ボタン群）

```css
.switch {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.switch-btn {
  padding: 4px 10px;
  border: none;
  border-right: 1px solid var(--border2);
  background: var(--surface);
  color: var(--text2);
  font-size: 12px; cursor: pointer;
}
.switch-btn:last-child { border-right: none; }
.switch-btn.active { background: var(--text); color: var(--bg); font-weight: 600; }
```

### チェックボックス行

```css
.check-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; cursor: pointer;
  padding: 3px 0;
  user-select: none;
}
.check-row input[type="checkbox"] {
  accent-color: var(--accent);
  width: 14px; height: 14px;
}
```

### セレクトボックス

```css
.ver-select {
  font-size: 11px; font-family: inherit;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text2);
  cursor: pointer;
}
.ver-select:disabled { opacity: 0.3; cursor: not-allowed; }
```

---

## 5. レスポンシブ戦略

```
ブレークポイント:
  mobile:  ≤ 520px  （1カラム、コンパクト）
  tablet:  ≤ 600px  （PC レイアウト切り替え境界）
  desktop: ≥ 601px

モバイル方針:
- grid は 1fr 1fr → 1fr に切り替え
- パディングは 12-16px を維持
- フォントサイズは縮小しない（最小 12px）
- safe-area-inset-* で iPhone ノッチ・ホームバー対応
  padding-bottom: max(16px, env(safe-area-inset-bottom))
```

---

## 6. アニメーション・トランジション

```
基本原則:
- duration:  0.12s（hover）/ 0.15-0.2s（状態変化）/ 0.18-0.25s（パネル開閉）
- easing:    ease（標準）/ ease-out（登場）/ ease-in（退場）
- transform: scale(0.96-0.97) でクリック押下感

CSS変数で管理推奨:
  --transition-fast:  0.12s ease
  --transition-base:  0.15s ease
  --transition-slow:  0.25s ease
```

---

## 7. コーディング規約

### HTML / テンプレート
- **ID はシングルトン**（ページに1つだけ存在する要素）、**class は再利用可能なもの**
- `data-*` 属性でJSのフックを持ち、スタイルのフックには使わない
- インラインスタイルは `style="display:none"` の初期非表示のみ許容。動的な表示切替は CSS class で行う
- `onclick=` はグローバル関数に限定。複雑なロジックはモジュール内の addEventListener で管理

### JavaScript
- **グローバル変数/関数は最小化**。モジュールごとにファイルを分け、公開が必要なものだけ global に置く
- 状態は単一の `state` オブジェクトまたは `xxxState` オブジェクトに集約（例: `aiState`, `slState`）
- DOM 操作は **初期化時に一度 querySelector**、キャッシュして再利用する
- API 呼び出しは必ず `try/catch`、エラーはUI に表示する（`console.error` だけにしない）
- `async/await` + `Promise.allSettled()` で並列呼び出し
- fire-and-forget（Notion保存など）は `.catch(() => {})` で明示的に握り潰す

### CSS
- **色・サイズ・シャドウは CSS 変数のみ**（ハードコード禁止）
- クラス命名: `コンポーネント名-要素名-修飾子` の BEM ライク規則
  - 例: `.ai-card-header`, `.ai-card-body`, `.tab-btn.active`
- セレクター深さは3段まで（`.ai-panel-inner .ai-config .ai-config-section` は NG → `.ai-config-section` で直接当てる）
- `!important` は使わない（モバイルレイアウトフォールバックの例外あり）

---

## 8. アンチパターン

| NG | 代替案 |
|---|---|
| `el.style.color = '#ff0000'` | CSS class の toggle / CSS 変数 |
| `document.write(...)` | innerHTML / createElement |
| APIキーをフロントに書く | Cloudflare Worker Secrets 経由で隠蔽 |
| `localStorage.setItem('key', apiKey)` | Worker の KV / Secrets に保存 |
| `const items = [...allItems]; items.reverse()` | `.toReversed()` またはコピーを明示 |
| `setInterval` でポーリング | WebSocket / SSE / ユーザーアクション起点 |
| `px` の固定サイズで font-size | CSS 変数 + `font-size: 13px` 基準スケール |
| 深いセレクター `.a .b .c .d {}` | コンポーネントクラスを直接ターゲット |
| マジックナンバー `height: 342px` | CSS 変数か `calc()` で意図を表現 |
| エラーを `console.log` だけで処理 | UIにエラー状態を表示する |
| `innerHTML` にユーザー入力を直接展開 | `textContent` / エスケープ処理 |

---

## 9. セキュリティチェックリスト

- [ ] ユーザー入力はすべて `textContent` か `escapeHTML()` でエスケープしてから DOM に挿入
- [ ] APIキーはコードに書かない（Cloudflare Secrets / 環境変数）
- [ ] CORS ホワイトリストを Worker で管理、`*` は使わない
- [ ] `.gitignore` に `.env`, `push.sh`, `*secret*` を追加
- [ ] `innerHTML` に連結する場合は XSS を意識して検証する

---

## 10. ファイル構成（参考）

```
/
├── index.html          エントリーポイント（HTML骨格のみ、ロジックなし）
├── assets/
│   ├── portfolio.css   スタイルシート（CSS変数・全コンポーネント）
│   └── *.png / *.svg   静的アイコン
├── src/
│   ├── state.js        定数 (C)・アプリ全体の状態 (state)
│   ├── data.js         外部API通信（WORKER_URL定義・fetch関数）
│   ├── utils.js        共通ユーティリティ（UI生成ヘルパー）
│   ├── auth.js         認証ロジック（PIN / パスキー）
│   ├── app.js          イベントハンドラ・タブ切り替え・テーマ
│   └── [feature].js    機能ごとのモジュール
├── worker/
│   ├── src/index.js    Cloudflare Worker（APIプロキシ・KV）
│   └── wrangler.toml   Worker設定
└── docs/
    ├── DESIGN.md       このファイル
    └── SPEC.md         外部設計書
```

---

## 11. Worker / API 設計原則

- フロントエンドは **Worker 経由でのみ** 外部 API を呼ぶ（APIキーはWorker Secrets）
- Worker は **CORS ホワイトリスト** で許可オリジンを管理
- KV は `key` を `feature:id` 形式で名前空間を分ける（例: `auth:challenge`, `watchlist`）
- Worker のルーティングは `if (path === '/xxx')` のシンプルな分岐（フレームワーク不要）
- エラーレスポンスは `{ error: 'メッセージ' }` JSON 形式に統一
