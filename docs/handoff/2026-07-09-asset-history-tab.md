# 設計ハンドオフ: Wealth タブ（資産推移）

> 対象者: VS Code 実装者
> 作成日: 2026-07-09 / 設計確定: 2026-07-09（ユーザー承認済み・GO）
> ステータス: **設計確定・実装待ち（B: VS Code 実装）**
> 実装 Issue: #568（実装 PR で `Closes #568`）

---

## 確定事項（2026-07-09 ユーザー承認）

- **タブ名: `Wealth`**（英語。他タブ Heatmap / Historical / Valuation / Risk / Briefing と統一）
- **タブ順: `Heatmap → Historical → Valuation → Risk → Wealth → Briefing`**（Wealth は Risk と Briefing の間）
- `data-tab="wealth"` / パネル `#panel-wealth` / スクリプト `src/wealth.js` / 関数 `renderWealthTab()`
- KPI・レイアウト・色・初期表示・追加要素は下記のまま（ユーザーから追加調整なし）

**視覚リファレンス（確定モック・実データSVG・このリポに同梱）**:
`docs/handoff/assets/2026-07-09-wealth-tab-mock.html`
→ これがレイアウト・配色・構成の正。ブラウザで開いて見た目を確認しながら実装すること。

---

## 目的

`src/_disabled/history.js` は旧仕様（localStorage の `hm-asset-history` に手動記録する簡易グラフ）のため有効化しない。
代わりに、Mac mini が毎日 `fetch_mf_history.py`（`fetch_mf.py run` から自動呼出）で蓄積している **MF 実データ `data/mf-history.json`** を読む新しい「Wealth」タブとして一から実装する。

---

## データソース

**ファイル**: `data/mf-history.json`（GitHub Pages から raw 経由で fetch）

```
https://raw.githubusercontent.com/shoulang0729/portfolio/main/data/mf-history.json
```

**スキーマ**:

```jsonc
{
  "source": "moneyforward.com/bs/history/csv",
  "unit": "JPY",
  "columns": ["date","total","cash","equity","equityMargin","fund","bond","crypto","fx","insurance","pension","points"],
  "updatedAt": "2026-07-09",
  "count": 151,
  "series": [
    { "date":"2014-09-30", "total":18193380, "cash":4769702, "equity":7273828,
      "equityMargin":0, "fund":5948948, "bond":0, "crypto":0, "fx":600,
      "insurance":0, "pension":96436, "points":103866 }
    // ... 151 件（直近=日次、過去=月末の混在）
  ]
}
```

**重要**: `total` 列は UI で使わない。総資産は各カテゴリの和
（`cash+equity+equityMargin+fund+bond+crypto+fx+insurance+pension+points`）で算出（独立検証も兼ねる）。

---

## UI 仕様（確定）

### 期間ピル
`3ヶ月 / 6ヶ月 / 1年 / 3年 / 5年 / 10年 / 全期間`
- 最新日付から月単位で起点を算出してフィルタ（例: 3ヶ月 = 最新日 − 3ヶ月）
- **デフォルト: 1年**／「全期間」はフィルタなし

### 表示切替ピル
`金額`（デフォルト） / `構成比%`（100% 積み上げ）
- 金額: 各カテゴリ絶対額の積み上げ面グラフ
- 構成比%: 各カテゴリを 0–100% 正規化した積み上げ（合計常に 100%）

### 対数軸チェック「対数軸（総資産）」
- OFF（デフォルト）: 上記の積み上げ面グラフ
- ON: 積み上げを解除し **総資産 1 本のラインチャート**を対数軸表示
- 理由: 積み上げ×対数は各カテゴリ実値が読めないため禁止（切替式にする）

### 目隠しボタン
- 既存 `#stats-eye` と同じ SVG（eye + eye-slash 線）を流用
- `localStorage` キー `hm-wealth-eye` で永続化
- ON 時: 金額（KPI・Y 軸・ツールチップ・年末表の金額列）を伏字（`••••••`）。**構成比%・各種比率は隠さない**

---

## KPI（グラフ上部・3枚）

| ラベル | 計算式 |
|---|---|
| 資産総額 | 最新レコードの各カテゴリ合計 |
| 現金比率 | `cash / 総資産 * 100` |
| 開設来倍率 | `最新総資産 / 初回総資産`（例: ×31.5） |

目隠し ON 時: 資産総額・開設来倍率は伏字。現金比率はそのまま。

---

## カテゴリ色

| カテゴリ | JSON キー | 色 |
|---|---|---|
| 株式（現物） | `equity` | `#cc785c` |
| 投資信託 | `fund` | `#7ba0c4` |
| 年金 | `pension` | `#9c8fbc` |
| 預金・現金 | `cash` | `#6fae86` |
| 保険 | `insurance` | `#d9a441` |
| 暗号資産 | `crypto` | `#c98a5e` |
| 債券 | `bond` | `#b0b0b0` |
| FX | `fx` | `#8c8c8c` |
| 株式（信用） | `equityMargin` | `#e09070` |
| ポイント | `points` | `#c9c2b8` |

- 背景・テキストは CSS 変数（`--bg`/`--surface`/`--text` 等）でライト/ダーク追従
- 値が常に 0 のカテゴリ（`equityMargin`/`bond`/`fx` 等）は凡例・チャートから省略してよい

---

## 追加チャート

### 現金比率の推移ライン
- 折れ線（別カード or 右 Y 軸オーバーレイ）。値 `cash/総資産*100`（%）。色 `#6fae86`

### 年末サマリ表
| 年 | 総資産 | 現金比率 | 株式比率 |
- `date` が `YYYY-12-31` に最も近いレコード。最新年は最終レコード。目隠し ON 時は総資産列を伏字

---

## 描画ライブラリ

**既存 D3 で実装する**（アプリは D3 を CDN=cdn.bootcdn.net で読込済み・CSP 許可済み）。
Chart.js を新規追加すると CSP `script-src` 追記が必要になるため避ける。
（モックは静的 SVG 直書き。実装は D3 で動的に。）

---

## タブ追加手順（骨子）

1. **`index.html` タブバー**: Risk と Briefing の**間**に追加
   ```html
   <button class="tab-btn" data-tab="wealth" role="tab" aria-selected="false"
           data-action="switchTab" data-arg="wealth" title="資産推移（MF実データ）">Wealth</button>
   ```
2. **`index.html` パネル**: `<section id="panel-wealth" class="tab-panel" hidden> … </section>`（KPI/ピル/チャート/表）
3. **`src/wealth.js` 新規**（`_disabled/history.js` は残す）: `data/mf-history.json` を fetch → 期間フィルタ/表示切替/対数/目隠し/KPI/D3描画。`renderWealthTab()` を公開
4. **`index.html` に `<script src="src/wealth.js?v=...">`**（`app.js` 直前・既存順に従う）
5. **`src/tabs.js` の `switchTab()`**: `if (name === 'wealth') renderWealthTab();`
6. **`?v=` を全置換でバンプ**（CSS・JS・SW 登録 URL 全箇所同一値）
7. **動作確認**
   - [ ] 期間ピル切替で再描画　- [ ] 金額↔構成比% 切替　- [ ] 対数 ON で総資産ラインのみ
   - [ ] 目隠し ON/OFF が localStorage 永続　- [ ] ダーク/ライトで色崩れなし　- [ ] 320px 幅で崩れない
   - [ ] タブ順が Risk → Wealth → Briefing になっている

---

## 注意事項
- `data/mf-history.json` は Mac mini launchd → `fetch_mf.py run` → 内部で `fetch_mf_history.py` を呼び毎日更新（2026-07-09〜）
- 日付は「直近=日次・過去=月末」の混在。X 軸はデータ点をそのまま打ち補間しない
- `total` 列は UI で使わない（各カテゴリ和を使う）
- 実装の見た目は `docs/handoff/assets/2026-07-09-wealth-tab-mock.html` に厳密準拠
