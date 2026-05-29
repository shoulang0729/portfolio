# Worker レート制限の設計判断

## 課題（Issue #62）

`checkRateLimit` は KV を `get → put` する 2 段階処理だったため、並列リクエストでカウンタが lost していた。

```js
// 旧実装（race あり）
const current = parseInt(await env.KV.get(key) || '0', 10);
if (current >= RATE_LIMIT_MAX) return true;
await env.KV.put(key, String(current + 1), { expirationTtl: 60 });
```

並列リクエスト A・B が同時に開始すると:

1. A: `get` → 100
2. B: `get` → 100（A の `put` 前）
3. A: `put` 101
4. B: `put` 101 ← 本当は 102 にすべき

並列度が高いほど実効レートが上限を超える。

## 検討した 3 案

### 案 A: Durable Objects を導入

- 単一インスタンスにシリアライズされるため、真の atomic increment が実現できる。
- 強整合性が必要なグローバルレート制限に最も適している。
- **却下理由**: 個人プロジェクトには過剰。`wrangler.toml` への DO バインディング追加 / マイグレーション / デプロイ手順の変更が必要。コストも KV より高い。

### 案 B: shard 分散方式（**採用**）

- カウンタを `rl:<ip>:<bucket>:<shard>` 形式で N 個の shard に分散。
- 書き込みは `Math.random()` で shard を選択 → 並列書き込みが同じキーを叩く確率が `1/N` に低下。
- 読み込みは全 shard を並列 GET して合算。
- **採用理由**: 既存 KV 構成のまま実装でき、エッジで完結する。1/N に低下した残余の race は許容誤差として割り切る。

### 案 C: Cloudflare Cache API を使う

- `cache.match` / `cache.put` は edge-local に atomic に近い動作。
- ただし edge ごとにカウンタが独立 → 「グローバルレート制限」ではなく「edge ごとの制限」になる。
- **却下理由**: グローバル制限の意味合いが変わる。CF の edge 数を超えるリクエストを許容してしまう。

## 案 B（採用案）の仕様

| パラメータ | 値 | 役割 |
|---|---|---|
| `RATE_LIMIT_MAX` | 120 | リクエスト / バケット |
| `RATE_LIMIT_WINDOW_MS` | 60_000 | バケット幅（60 秒） |
| `RATE_LIMIT_SHARDS` | 4 | shard 数 |
| `RATE_LIMIT_TTL` | 120 秒 | shard キー TTL（バケット境界跨ぎ対策） |

### キー設計

```
rl:<ip>:<bucket>:<shard>
  bucket = floor(Date.now() / 60_000)
  shard  = Math.floor(Math.random() * 4)
```

### 動作

1. 同 IP + 同 bucket の全 shard を並列 GET。
2. 合算値が `RATE_LIMIT_MAX` 以上なら 429。
3. shard をランダム選択して `+1` を `put`（`await` なし）。

### 補足

- 書き込みは `await` せず、失敗しても次リクエストで挽回（レイテンシ削減）。
- 旧キー `rl:<ip>` も移行期間中は合算（TTL 60s で自然消滅後に削除予定）。
- bucket はタンブリングウィンドウ。境界跨ぎで瞬間的に最大 2 × `RATE_LIMIT_MAX` を許容する可能性あり（既存実装と同等の挙動）。

## 許容誤差

| シナリオ | 旧実装での超過 | 案 B での超過 |
|---|---|---|
| 100 並列リクエスト | 最大 100 回（全てが race） | 期待値 ~25 回（1/4 が同 shard に衝突） |
| 通常負荷 | カウントロスト頻発 | ほぼ正確 |

`RATE_LIMIT_SHARDS = 4` の場合、レース衝突確率は 1/4 = 25%。
`RATE_LIMIT_MAX = 120` に対して、悪意ある攻撃でも実効上限は概ね 120〜160 req/min に収まる想定で、防御目的としては十分。

## 将来の対応

- 完全な atomic が必要になった場合は案 A（Durable Objects）に移行する。
- Cloudflare WAF レート制限（Issue #16）を導入すれば、エッジでより低レイテンシな防御が可能。
