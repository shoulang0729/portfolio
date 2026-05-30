# フロントエンド実装の落とし穴メモ

実装中に踏んだ一般的な（プロジェクト非依存の）フロントエンドの罠と対策を蓄積する。
他プロジェクトにもコピーして引き継げる。新しい知見は**その都度ここに追記**する。

> エージェント運用の知見は [multi-agent-orchestration.md](./multi-agent-orchestration.md)、
> 機能仕様は Wiki（`docs/wiki/`）。本ファイルは「UI/DOM/CSS の実装トラップ」専用。

各エントリの書式: **症状 / 原因 / 対策 / 教訓（再発防止チェック）**。

---

## 1. `hidden` 属性が `display` を持つ CSS ルールに上書きされる（#210）

**症状**: JS で `el.hidden = true`（または `[hidden]` 属性付与）しているのに要素が消えない。
特定タブ専用のはずの UI（例: 詳細列トグルの目アイコン）が全タブで表示され続ける。

**原因**: HTML の `hidden` 属性は UA スタイル `[hidden] { display: none }` で効くが、これは
**詳細度が最弱**。要素に `.foo { display: flex }` のような `display` 指定が当たっていると、
そちらが勝って `hidden` が無効化される。

```css
.sl-controls { display: flex; }   /* これが hidden を打ち消してしまう */
```

```js
slControls.hidden = (name !== 'list');  // 効かない（CSS の display:flex が勝つ）
```

**対策**: `display` を持つクラスには、明示的に `[hidden]` 打ち消しルールを書く。

```css
.sl-controls[hidden] { display: none; }
```

**教訓（再発防止チェック）**:
- `el.hidden` / `[hidden]` で出し入れする要素に **`display` 指定があるか**を必ず確認する。
- あるなら **`.セレクタ[hidden] { display: none; }` をセットで書く**（既存の
  `.tab-panel[hidden] { display: none; }` が好例）。
- 「JS で hidden にしているのに消えない」は、ほぼこのパターンを疑う。
- 同じパターンの兄弟要素（例: `.wl-search-wrap`）が `display` を持たないなら、
  そちらは UA スタイルで正しく消えるので対処不要。要素ごとに確認すること。
