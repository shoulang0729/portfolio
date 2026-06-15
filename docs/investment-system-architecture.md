# 投資システム アーキテクチャ（2026/06 改訂）

MulmoClaude を頭脳とした投資運用システムの設計。本リポジトリ（portfolioアプリ）が担う部分を中心にまとめる。運用の本体は MulmoClaude Wiki `investment-system-architecture.md` を参照。

> 📊 全体像を1枚で俯瞰する図 → [investment-architecture.md](./investment-architecture.md)（アーキテクチャ図＋凡例＋データフロー）

## 3本柱

| 柱 | 内容 | 本repoの担当 |
|---|---|---|
| 1 データ | Claude for Chrome が MF→`data/mf-holdings.json` を更新 | データ供給元。Heatmap がこれを読む |
| 2 壁打ち | MulmoClaude本体（Telegram/web UI）に一本化 | アプリの旧AI壁打ちタブ(`src/_disabled/`)は復活させない |
| 3 週次 | Mulmoが Briefing(モバイルHTML) を生成・配信 | アプリに「Briefing」タブを新設 |

## 柱1：mf-holdings.json

- ルール: `data/mf-import-config.json`（allowlist＋口座denylist＋現金含む＋チェックサム1%）。
- 出力: `data/mf-holdings.json` = 履歴なしフラット配列（毎回まるごと上書き安全）。
- `portfolio-snapshot.json` は **直接編集しない**（`performance` 履歴が壊れる）。
- 手順書: `docs/routine_mf_discovery.md`（初回口座棚卸し）/ `docs/routine_mf_snapshot.md`（定常）。
- 取込対象4口座（2026/06）: SMBC信託 / マネックス証券 / bitFlyer / ひふみ投信。

### mf-holdings.json スキーマ（例）
```json
{
  "asOf": "ISO8601", "source": "moneyforward/claude-for-chrome", "configVersion": 2,
  "totals": { "mfNetWorth": 0, "imported": 0, "excludedAccounts": 0 },
  "holdings": [
    { "account": "マネックス証券", "cat": "米国株・ETF", "name": "アップル",
      "symbol": "AAPL", "ySymbol": "AAPL", "shares": 186,
      "avgCost": 208.92, "price": 308.33, "value": 9072672, "cur": "USD" }
  ]
}
```

## 柱3：Briefing タブ（実装メモ）

- 置き場所: `data/briefings/YYYY-MM-DD.html`（自己完結モバイルHTML）＋ `data/briefings/index.json`（号の一覧: date/title/path）。
- タブ実装: `tabs.js` に「Briefing」を追加。新モジュールで `index.json` を fetch → 最新号を `<iframe>` で表示 → 下に過去号リンク一覧。
- HTML はアプリ配色（`--accent #cc785c` 等）に合わせ、ライト/ダーク追従。サンプル: MulmoClaude artifacts の briefing-v3。
- 構成（順序確定）: **1 サマリ / 2 トレンド / 3 マクロ / 4 ヘルスチェック / 5 PERアナリシス / 6 メンター / 7 トリガー＆アクション**。`<section id="sN">`・`<b>N</b>`・上部 `.nav` の番号/ラベル/順序は常にこの並びで一致させる。
  - **§1 サマリ**: 資産総額カード（最上段）＋まとめ箇条書きカード（タイトルなし）の2枚構成。
    - **資産総額カード（§1 最上段・必須）**: アプリの stats バーは廃止。資産総額はここが唯一の表示場所。金額はすべて**1円単位（カンマ区切り）**。目アイコンボタンで `.maskable` 要素を blur トグル。
      ```html
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div class="total maskable">¥XXX,XXX,XXX<small>資産総額（Money Forward実値・YYYY-MM-DD）</small></div>
          <button id="mask-btn" onclick="toggleMask()" title="金額の表示切替" aria-label="金額の表示切替">
            <svg id="eye-open" …>…</svg>
            <svg id="eye-closed" … style="display:none">…</svg>
          </button>
        </div>
        <div class="cashline" style="align-items:flex-end;">
          <div style="display:flex;flex-direction:column;gap:3px;"><span class="k">現預金</span><span class="v maskable">¥XX,XXX,XXX</span></div>
          <div style="display:flex;flex-direction:column;gap:3px;"><span class="k">投資用キャッシュ</span><span class="v maskable">¥XX,XXX,XXX</span></div>
          <div style="display:flex;flex-direction:column;gap:3px;"><span class="k">キャッシュ比率</span><span class="v">≈XX%</span></div>
        </div>
      </div>
      ```
      CSS: `.masked .maskable{filter:blur(8px);pointer-events:none;user-select:none;}`
      JS（body末尾）: `function toggleMask(){ var m=document.body.classList.toggle('masked'); document.getElementById('eye-open').style.display=m?'none':''; document.getElementById('eye-closed').style.display=m?'':'none'; }`
    - **まとめカード（§1 第2カード）**: タイトルは `<div class="sum-h">今週のまとめ</div>`（絵文字なし・シンプル）。資産行は**出さない**（上の資産総額カードに集約済み）。地合い・PER・メンター・ヘルス・アクションのみ `<div class="sum-row">` で列挙。
  - **§2 トレンド**: 1枚のカードに「今週」と「来週」をまとめる。
    - **✅ §2 の構成**:
      ```html
      <div class="card">
        <div class="subh">今週</div>
        <div class="trend-stance"><span class="stance">⚠ …</span></div>
        <table class="perf">…地合い（行＝主要指数。列＝金曜終値・週末等）…</table>
        <div class="movers">…追い風/向かい風…</div>
        <div class="subh" style="margin-top:14px;padding-top:13px;border-top:1px solid var(--border);">来週</div>
        …<div class="ev">…</div> イベントリスト…
        <div class="note">…日付・免責注記…</div>
      </div>
      ```
    - **スタンス**（⚠ 黄信号 等）は §2 トレンドの `今週` 直後 `.trend-stance` に置く（ヘッダーには出さない）。
  - **§3 マクロ**: ドル円・VIX の各期間セルは**実数値（指数水準/レート）で表示**（％ではなく）。セルの色（up=赤/down=緑）は現在値への騰落方向を維持。株価指数は騰落%、債券は bp のまま。
  - **§5 PERアナリシス**: 保有銘柄に加え**ウォッチリスト銘柄も評価対象に含める**（「ウォッチリスト（監視中）」サブ見出しで保有と区別）。見出しに**絵文字（👁 等）は使わない**（細線 SVG アイコンか無し。ミニマル統一）。
  - **§6 メンター** = じっちゃま・中島聡・**ゆな先生・藤沢数希**。トリガー＆アクションの直前に置く。
  - **本文ヘッダー**: 大見出し `<h1>Briefing</h1>` は**載せない**（アプリのタブで「Briefing」は明示済み・重複）。`.date` は**日付のみ**（例「2026/06/14（日）週次」）。スタンスはヘッダーに出さず §2 トレンド先頭へ。アプリ側ツールバーも号タイトル/日付ラベルは出さず、生成ボタンのみのミニマル表示。
- **タブが5個になるため、タブバーをスマホ最適化**（アイコン＋短ラベル、必要なら横スクロール）。
- 生成 = **土曜朝**の MulmoClaude 週次タスク。publish = **ホストにGit push認証(PAT)常設**して無人commit（確定）。

## 廃止・宿題

- 日次2本の Notion ルーティン（`docs/routine_japan_1700.md` / `routine_us_0600.md`）は **廃止**（トークン節約）。PER割高割安ノウハウは Briefing #5 と壁打ちに継承。
- 現金二重計上: `src/manual-assets.js` の現金ハードコードを撤去（mf-holdingsに現金を含めるため）。
- 旧 `portfolio-snapshot.json` 依存の下流（日次ルーティン廃止後の整理、Heatmapのデータ源整理）は段階移行。
