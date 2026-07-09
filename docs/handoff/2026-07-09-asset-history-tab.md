# 設計ハンドオフ: 資産推移タブ復活

> 対象者: VS Code 実装者
> 作成日: 2026-07-09
> ステータス: 設計確定・実装待ち

---

## 目的

`src/_disabled/history.js` は旧仕様（localStorage の `hm-asset-history` キーに手動記録する簡易グラフ）のため、そのまま有効化しない。
代わりに、Mac mini が毎日 `fetch_mf_history.py` で蓄積している **MF 実データ `data/mf-history.json`** を読み込む新しい「資産推移」タブとして一から実装する。

---

## データソース

**ファイル**: `data/mf-history.json`（GitHub Pages から raw.githubusercontent.com 経由で fetch）

```
https://raw.githubusercontent.com/shoulang0729/portfolio/main/data/mf-history.json
```

**スキーマ**:

```jsonc
{
  "source": "moneyforward.com/bs/history/csv",
  "unit": "JPY",
  "columns": ["date", "total", "cash", "equity", "equityMargin", "fund", "bond", "crypto", "fx", "insurance", "pension", "points"],
  "updatedAt": "2026-07-09",  // 最終更新日（文字列 YYYY-MM-DD）
  "count": 151,
  "series": [
    {
      "date": "2014-09-30",   // YYYY-MM-DD
      "total": 18193380,      // ※total 列は MF CSV 由来だが合計チェック用。UI では使わない
      "cash": 4769702,
      "equity": 7273828,
      "equityMargin": 0,
      "fund": 5948948,
      "bond": 0,
      "crypto": 0,
      "fx": 600,
      "insurance": 0,
      "pension": 96436,
      "points": 103866
    },
    // ... 151 件（直近=日次、過去=月末の混在）
  ]
}
```

**重要**: `total` 列は UI で使用しない。総資産は `cash + equity + equityMargin + fund + bond + crypto + fx + insurance + pension + points` の和として算出すること（合計値の独立検証も可能）。

---

## UI 仕様（確定）

### 期間ピル

3ヶ月 / 6ヶ月 / 1年 / 3年 / 5年 / 10年 / 全期間

- 実装: 最新日付から月単位で起点を算出してフィルタ（例: 3ヶ月 = 最新日 - 3ヶ月）
- デフォルト: 1年
- 「全期間」はフィルタなし

### 表示切替ピル

**金額** / **構成比%**（100% 積み上げ）

- 金額: 各カテゴリの絶対額を積み上げ面グラフ
- 構成比%: 各カテゴリを 0–100% に正規化した積み上げ面グラフ（合計は常に 100%）

### 対数軸チェック

チェックボックス「対数軸（総資産）」

- OFF（デフォルト）: 上記の積み上げ面グラフ（金額 or 構成比%）
- ON: 積み上げを解除し、**総資産 1 本のラインチャート**を対数軸で表示
- 理由: 積み上げ面グラフと対数軸の組み合わせは各カテゴリの実値が正確に読めないため禁止

### 目隠しボタン

- 既存の `#stats-eye` ボタンと同じ SVG アイコン（eye アイコン + eye-slash 線）を流用
- `localStorage` キー `hm-eye`（または新規 `hm-history-eye`）で永続化
- 目隠し ON 時: 金額（KPI・Y 軸ラベル・ツールチップ・年末サマリ表の金額列）を伏字（`••••••`）
- 構成比% は目隠し対象外（比率は隠さない）

---

## KPI（グラフ上部）

| ラベル | 計算式 |
|---|---|
| 資産総額 | `series` 最新レコードの各カテゴリ合計 |
| 現金比率 | `cash / 総資産 * 100` |
| 開設来倍率 | `最新総資産 / 初回総資産`（例: 31.5x） |

目隠し ON 時: 資産総額・開設来倍率は伏字。現金比率はそのまま表示。

---

## カテゴリ色

| カテゴリ | JSON キー | 色（hex） |
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

- **テーマ対応**: 上記は固定 hex だが、背景・テキストは CSS 変数 `--bg`, `--surface`, `--text` 等に準拠してライト/ダーク追従
- 値が 0 のカテゴリは凡例とチャートから省略可

---

## 追加チャート

### 現金比率の推移ライン

- 折れ線グラフ（積み上げとは別軸 or 積み上げグラフの右 Y 軸にオーバーレイ）
- 値: `cash / 総資産 * 100`（%）
- 色: 現金カテゴリと同色（`#6fae86`）の破線

### 年末サマリ表

各年の 12 月末（または最新レコード）を集計してテーブル表示。

| 年 | 総資産 | 現金比率 | 株式比率 |
|---|---|---|---|
| 2014 | ¥XX百万 | 26.2% | 40.0% |
| ... | | | |
| 2026 | ¥XXX百万 | 10.3% | 59.1% |

- 年末データは `date` が `YYYY-12-31` に最も近いレコードを選択
- 最新年は最終レコードをそのまま使用
- 目隠し ON 時: 総資産列を伏字

---

## 描画ライブラリ

**推奨: 既存 D3 で実装する**

アプリはすでに D3 を CDN（cdn.bootcdn.net）で読み込んでおり、CSP の `script-src` に許可済み。Chart.js を新規追加すると `script-src` に CDN を追記する CSP 更新が別途必要になるため、**まずは D3 で実装する方針を強く推奨**する。

> Chart.js を使う場合は `index.html` の CSP meta タグ（`script-src`）に Chart.js CDN を追加し、`?v=` を同時にバンプすること。

---

## 参考プレビュー

設計時の見た目参照用 HTML（Chart.js 版モックアップ）は Mulmo ワークスペース側に保管:

```
artifacts/html/2026/07/mf-history-preview.html
```

このファイルは portfolio リポジトリにはコミットしない。

---

## タブ追加手順（骨子）

1. **`index.html` タブバーに追加**
   ```html
   <button class="tab-btn" data-tab="history" aria-label="資産推移">資産推移</button>
   ```

2. **`index.html` にパネルを追加**（`<section id="panel-risk">` 等と同じ構造）
   ```html
   <section id="panel-history" class="tab-panel" hidden>
     <!-- KPI / ピル / チャート / 年末サマリ表 がここに入る -->
   </section>
   ```

3. **新ファイル `src/history-mf.js` を作成**（`src/_disabled/history.js` はそのまま残す）
   - `data/mf-history.json` を fetch して `series` を取得
   - 期間フィルタ・表示切替・対数軸・目隠し・KPI・D3 描画を実装
   - `renderHistoryMfTab()` / `initHistoryMfTab()` をグローバルに公開

4. **`index.html` に `<script>` を追加**
   ```html
   <script src="src/history-mf.js?v=YYYYMMDDX"></script>
   ```
   - 読み込み順: `app.js` の直前に配置（既存スクリプト順に従う）

5. **`src/tabs.js` の `switchTab()` に分岐を追加**
   ```js
   if (name === 'history') renderHistoryMfTab();
   ```

6. **`?v=` を全置換でバンプ**（index.html 内の CSS・JS・SW 登録 URL 全箇所を同一値に）

7. **動作確認チェックリスト**
   - [ ] 期間ピル切替でチャートが再描画される
   - [ ] 金額 ↔ 構成比% 切替が正しく動作する
   - [ ] 対数軸 ON で積み上げが消え総資産ラインのみになる
   - [ ] 目隠し ON/OFF が localStorage に永続化される
   - [ ] ダークモード / ライトモードで色が崩れない
   - [ ] モバイル（320px 幅）でレイアウトが崩れない

---

## 注意事項

- `data/mf-history.json` は Mac mini の launchd → `scripts/fetch_mf.py run` → 内部で `fetch_mf_history.py` を呼び出す形で毎日更新される（2026-07-09 以降）
- 日付は「直近=日次・過去=月末」の混在。X 軸はデータ点をそのまま打ち、補間しない
- `total` 列は MF が返す値だが UI では使用しない（各カテゴリの和を使う）
- 0 値カテゴリ（`equityMargin`, `bond`, `fx` 等）は積み上げに含まない、または凡例を非表示にして表示をすっきりさせること
