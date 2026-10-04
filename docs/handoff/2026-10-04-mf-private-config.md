# MF 取込設定の実名を公開リポから外す（非公開ローカル設定への移設）（#687）

- **Issue**: #687 `MF 取込設定の口座名・金融機関名を公開リポから外す`
- **サイズ**: M（`scripts/fetch_mf.py` の設定読み込み・公開用の除去処理・`data/mf-import-config.json` の中身／公開 `data/mf-holdings.json` の値の変更）
- **分担**: 設計＝architect（本書）／実装＝implementer（PR ごとに 1 ブランチ 1 PR）／レビュー＝reviewer
- **承認**: 方針は Toshio 承認済み（2026-10-04）。各 PR は「マージ前の確認」対象（資産データ・データ構造）＝reviewer は `needs-toshio` で止める。
- **公開リポの前提**: 本書・Issue・PR 本文・コミットメッセージ・テスト・通知メッセージに、**実在の口座名・金融機関名・家族名・勤務先名を書かない**。例はすべて架空名（「テスト銀行」「テスト交通系IC」など）。件数で語れるところは件数で語る。

## 実装ログ（implementer が更新）
| PR | branch | PR | 状態 |
|---|---|---|---|
| PR1 公開コピーから口座名を除去＋`--dry-run` | `fix/____-mf-public-sanitize-institution` | #687 | 未着手／Mac 実機確認要（マージ前） |
| PR2 非公開ローカル設定の重ね合わせ＋公開 config の実名削除 | `fix/____-mf-private-config` | #687 | 未着手（PR1 後）／Mac 実機確認要（マージ前）／macops の事前作業要 |

- [ ] macops: Mac mini に非公開設定を作成（§7 手順 1。中身はどこにも貼らない）
- [ ] git 履歴の扱い（§9）: Toshio 判断 ＿＿＿（A 残す / B 文字列置換で履歴書き換え）

---

## 1. 背景・ゴール

### 背景
公開リポの `data/mf-import-config.json` に、次の実名が入っている（2026-10-04 時点・種類と件数のみ記す）。

| 場所 | 中身（種類） |
|---|---|
| `exclude.accounts`（7件） | 家族名入りの交通系IC名、交通系IC、勤務先の持株会名、暗号資産口座名、ロボアド口座名、相対取引の契約口座名 |
| `exclude.note` | 取り込みに戻した銀行・信金の名前、子どもの NISA 口座名（家族名入り）、取込対象の金融機関一覧 |
| `include.note` | 年金を外した理由として信託銀行名 |
| `scripts/fetch_mf.py` `_account_excluded()` | 「完全名で判定する」特例として暗号資産口座名を**コードにハードコード** |
| `scripts/README-mf-snapshot.md` | 上と同じ口座名 |

調査で、**同じ実名が毎日 `data/mf-holdings.json` にも書き出されている**ことが分かった（config だけ外しても漏れが止まらない）。

| `data/mf-holdings.json`（公開・MF バッチが毎日 main に commit） | 中身 |
|---|---|
| `totals.excludedAccounts` | 除外にマッチした口座名（実名）の配列 |
| `holdings[].institution` | 取込対象の全口座の金融機関名（子どもの NISA 口座名を含む） |

`build()` が両方を作り、`sanitize_for_public()` は負債・実物資産系しか消していない。

### 誰が何を読んでいるか（調査結果）
| 読み手 | 読むキー | 本件の影響 |
|---|---|---|
| `scripts/fetch_mf.py` | `exclude.accounts`（`build`/`_row_imported`/`verify`）、`include.categories`、`include.liabilities`、`liabilityAccountMap`、`fetch.*`、`categoryToCat`、`checksum`、`cash`、`realAssets` | 設定の読み込み元を変える（PR2） |
| `scripts/fetch_mf_history.py` | `fetch.userDataDir`・`fetch.timeoutMs` だけ | 影響なし（公開 config だけ読み続ける） |
| `tests/test_fetch_mf.py` | 公開 config を読み、テスト内で架空の除外名を足す | PR1/PR2 で追従 |
| アプリ（`src/**`） | **`mf-import-config.json` は読まない**。`mf-holdings.json` は読むが `institution`・`excludedAccounts` は読んでいない（`holdings-from-mf.js` の型注釈にあるだけ。使うのは `cat`/`name`/`value`/`cur`/`asOf`/`ySymbol`/`avgCost`/`price`/`qty`） | 外しても画面は壊れない |
| Worker（`worker/src/**`） | `mf-import-config.json` は読まない。注文表（`order-sheet-calc.js` の米ドル預り金判定）は `holdings[].institution` を使うが、読むのは **KV の `networth`（完全版）**であって公開ファイルではない | KV には今までどおり実名入りの完全版を送る＝影響なし |
| Mulmo | `docs/briefing-generation-spec.md`・`docs/mulmo-data-scripts-asis.md` に `institution`/`excludedAccounts` の参照なし | 影響なしの見込み。**Toshio 確認事項 Q3** |

### ゴール
1. 公開リポの**現在のファイル**（config・`mf-holdings.json`・コード・docs）から、口座名・金融機関名の実名が消える。
2. 除外の判定結果は**今と同じ**（除外される口座・取り込まれる口座・`imported`・チェックサムが変わらない）。
3. 実名は Mac mini のリポ外ファイルにだけ置く。そのファイルが無い・壊れているときは**取込を中止して通知**（安全側）。
4. 完全版（KV `networth`）は今までどおり実名入り（注文表などの非公開機能を壊さない）。

## 2. 方式の比較と決定

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| **A（採用）** 非公開ローカル設定を重ねる | 実名の入るキーを Mac mini の `~/.mf-snapshot/private-config.json`（リポ外）に移し、`fetch_mf.py run` が起動時に公開 config へ重ねる。公開側は空配列＋説明だけ | 実名がリポに一切残らない。今の判定と完全に同じ結果にできる。今まで「非公開ストア側の別タスク（未実装）」だった `liabilityAccountMap` の置き場にもなる | Mac mini にファイルが1つ増える（バックアップ・作り直しの手順が要る） |
| B 部分一致のぼかしパターンに置き換える | 実名を「交通系IC」「持株会」のような一般語に置き換え、公開 config に残す | 新ファイル不要 | 一般語でも「どんな口座を持っているか」は残る。家族名・勤務先を消すと部分一致が効かなくなる口座がある（名前の一部しか特徴がない）。一般語は他の口座に誤って当たる危険が増える。`mf-holdings.json` 側の漏れは別途必要 |
| C（A＋B の折衷） | 一般語で足りるものだけ公開に残し、残りを非公開に | 非公開ファイルが小さい | 正本が2か所に割れ、どちらで除外されたか追いにくい |

**決定: A**。除外リストの正本は非公開ファイル1か所にする（公開側は常に空）。B/C は採らない。
`mf-holdings.json` 側の漏れは、どの案でも `sanitize_for_public()` の修正が必要なので PR1 で別に直す。

## 3. 仕様

### 3.1 非公開ローカル設定（Mac mini のみ・リポ外）
- 既定パス: `~/.mf-snapshot/private-config.json`（ブラウザプロファイル `~/.mf-snapshot/profile` と同じ場所）。環境変数 `MF_PRIVATE_CONFIG` があればそちらを優先（テストと検証用）。
- 推奨パーミッション: `600`。グループ/他人に読み権限があれば通知で警告だけ出す（中止はしない）。
- 形（**許可するキーはこれだけ**。それ以外のキーがあれば中止）:

```json
{
  "version": 1,
  "exclude": {
    "accounts": ["テスト交通系IC", "テスト社員持株会", "=テスト暗号口座"]
  },
  "liabilityAccountMap": { "テスト銀行A": "自宅" }
}
```

- `exclude.accounts`: 文字列の配列（必須・1件以上）。**`=` で始まる要素は完全一致**、それ以外は今までどおり部分一致（`要素 in 金融機関名`）。今コードにハードコードしている暗号資産口座の完全一致特例は、この `=` 記法に置き換えてコードから実名を消す。
- `liabilityAccountMap`: 任意。口座/金融機関名（部分一致）→ 用途タグ。結果は KV の完全版にだけ載る（公開コピーは `liabilities` ごと消える）。入れるかどうかは macops/Toshio の任意（本件の必須作業ではない）。
- **許可しないもの**: `fetch.realEstate.nameMap`（物件名）。`update_real_assets()` が `data/real-assets/` を公開 commit 対象にするため、別設計なしに有効化しない（§5）。`exclude.holdings` も現行コードが読んでいないので許可しない。

### 3.2 重ね合わせのルール（`fetch_mf.py`）
- 新関数 `load_config(public_path=CONFIG, private_path=None)` を作る。`private_path` が None なら `MF_PRIVATE_CONFIG` → 既定パスの順。
- 手順: 公開 config を読む → 非公開ファイルを読む → 検証（§3.3）→ 重ねる。
  - `exclude.accounts` = 公開の配列 ＋ 非公開の配列（重複は除く。公開側は空なので実質は非公開の中身）。
  - `liabilityAccountMap` = 公開（`note` だけ）に非公開のキーを足す（非公開が優先）。
- 戻り値は今の `cfg()` と同じ形の dict（`build`/`verify`/`attach_liabilities` は変更不要）。
- 呼び分け:

| コマンド | 読む設定 | 非公開ファイルが無いとき |
|---|---|---|
| `run`（launchd の定常） | 公開＋非公開 | **ブラウザを起動する前に中止**。通知して `exit(6)`。ファイル書き出し・KV 送信・commit はしない |
| `run --dry-run`（PR1 で新設） | 公開＋非公開（PR2 以降） | 同上（中止） |
| `check-config`（PR2 で新設） | 公開＋非公開 | 中止（exit 6） |
| `setup`（初回ログイン） | 公開だけ | 影響なし（ログインだけなので不要） |
| `fetch_mf_history.py` | 公開だけ（変更しない） | 影響なし |

### 3.3 検証と中止条件（どれか1つでも当たれば `run` を中止・exit 6・通知）
1. ファイルが無い。
2. JSON として読めない。
3. 許可外のキーがある（トップレベル・`exclude` 配下とも）。
4. `exclude.accounts` が無い・配列でない・空・文字列以外を含む・`=` だけの要素がある。
5. `liabilityAccountMap` が object でない、または値が文字列でない。
6. **公開 config の `exclude.accounts` が空でない**（実名が公開側に戻ってきた退行を検知。テストでも固定する）。

- **通知・ログに実名を出さない**。出してよいのはパスの種類（既定/環境変数）、件数、どの条件で落ちたか。例: `非公開設定が見つからない（既定パス）。取込を中止。README-mf-snapshot.md の手順で作成して。`
- 中止を選ぶ理由: 非公開ファイルが無いまま走ると除外が0件になり、除外したい口座（家族・勤務先関連）の保有が**公開の `mf-holdings.json` に書かれて main に push される**。公開 commit は revert しても履歴に残るため、取込を1日止める方が安い。`mf-freshness.yml` が古さを検知するので「止まったこと」にも気づける。

### 3.4 公開コピーから口座名を消す（`sanitize_for_public()`・PR1）
今の除去（`liabilities`・`totals` の負債/実物資産/計算純資産）に加えて:
- `totals.excludedAccounts` → `[]`（キーは残す＝形は変えない）。
- `holdings[].institution` → `""`（キーは残す＝`schema.holding.required` の形を保つ）。
- 引数の doc は変えない（今どおり deep copy）。KV に送る完全版は実名のまま。

前後比較（合成値）:

```text
前: totals.excludedAccounts = ["テスト社員持株会", "テスト交通系IC"]
    holdings[0] = {"institution": "サンプル証券", "cat": "日本株・ETF", "name": "サンプル日本株", "value": 1000000, ...}
後: totals.excludedAccounts = []
    holdings[0] = {"institution": "", "cat": "日本株・ETF", "name": "サンプル日本株", "value": 1000000, ...}
    （cat/name/value/cur/asOf/ySymbol/avgCost/price/qty・imported・mfNetWorth は前後で同じ）
KV networth（完全版）: 前後とも institution・excludedAccounts は実名のまま（変更なし）
```

- 同じ銘柄を複数口座で持つ行は、公開コピーでは口座の区別が消えるだけで行は統合しない（`holdings-from-mf.js` は今も `institution` を見ずに ySymbol で集約している）。

### 3.5 公開 config の書き換え（PR2）
前後比較:

```text
前: exclude.accounts = [実名×7]
    exclude.note = 実名入りの棚卸し経緯と取込対象一覧
    include.note = 年金除外の理由に信託銀行名
後: exclude.accounts = []
    exclude.note = 「実名の除外リストは Mac mini の非公開設定（~/.mf-snapshot/private-config.json）が正本。
                    ここは常に空。'=' 始まりは完全一致、それ以外は部分一致。手順は scripts/README-mf-snapshot.md」
    include.note = 年金をカテゴリごと除外した理由を、金融機関名なしで書き直す
                  （例:「一部の年金口座が口座名マッチで判定できないためカテゴリ除外が確実」）
```

- `version` は上げない（キーの追加・削除なし。`exclude.accounts` の値が空になり、記法として `=` 完全一致が増えるだけ）。ただし `=` 記法の追加は判定仕様の変更なので Toshio 確認対象として扱う。
- `exclude.holdings`（空）・`liabilityAccountMap`（note のみ）・`fetch.realEstate.nameMap`（note のみ）はキーを残す。`liabilityAccountMap.note` は「実マップは非公開設定に置ける」に更新する。

### 3.6 `check-config` と `run --dry-run`（Mac で安全に確かめる手段）
CLAUDE.md のとおり `run` は feature ブランチで実行できない（main への自動 commit/push 前提）。マージ前の Mac 確認のために、書き込みをしないモードを用意する。
- `check-config`（PR2）: ネットワークもブラウザも使わず、重ね合わせ結果の**件数だけ**を表示する。出力例: `private=default exclude.accounts=7（完全一致1） liabilityAccountMap=0 public.exclude.accounts=0 OK`。
- `run --dry-run`（PR1）: 取得 → `build` → `verify` まで行い、**ファイル書き出し・`update_real_assets`・KV 送信・git をすべてしない**。表示は件数と一致判定だけ:
  - `holdings` 件数、除外口座の件数、
  - 手元の `data/mf-holdings.json`（直近の本番出力）と比べた「取込対象の金融機関の集合が一致／不一致」「除外口座の集合が一致／不一致」「`imported` が ±1% 以内か」（実名と金額は表示しない）、
  - 公開コピーの検査結果（`institution` が空でない行の数＝0、`excludedAccounts` の長さ＝0、`liabilities` キーなし）。
  - PR1 マージ後は本番の `mf-holdings.json` から実名が消えるので、集合の比較は「マージ前に Mac 上で一度だけ」使えればよい。PR2 の確認では KV ではなく、PR2 ブランチ上の dry-run と main（PR1 済み）上の dry-run の結果（件数・`imported`）を並べて比べる（§7）。

## 4. 対象ファイル

| ファイル | 状態 | PR | 内容 |
|---|---|---|---|
| `scripts/fetch_mf.py` | 変更 | PR1 | `sanitize_for_public()` で `excludedAccounts`・`institution` を空にする。`run --dry-run` を追加 |
| `tests/test_fetch_mf.py` | 変更 | PR1 | 公開コピーに実名が残らないこと・完全版は不変のことを検証 |
| `scripts/fetch_mf.py` | 変更 | PR2 | `load_config()`・検証・`=` 完全一致・`check-config`・`run` の起動時中止。`_account_excluded()` からハードコード実名を削除 |
| `data/mf-import-config.json` | 変更 | PR2 | `exclude.accounts` を空に。`exclude.note`・`include.note`・`liabilityAccountMap.note` を実名なしで書き直す |
| `tests/test_fetch_mf.py` | 変更 | PR2 | 重ね合わせ・中止条件・`=` 記法・公開 config 空の退行テスト。`_load_config()` を一時ファイルの合成非公開設定経由に |
| `scripts/README-mf-snapshot.md` | 変更 | PR2 | 非公開設定の作り方・バックアップ・`check-config`/`--dry-run` の使い方。実名の口座名を削除 |
| `docs/routine_mf_discovery.md`・`docs/routine_mf_snapshot.md` | 変更 | PR2 | 「`exclude.accounts` を見直す」→「Mac mini の非公開設定を見直す（中身は貼らない）」 |
| `docs/handoff/2026-06-21-mf-snapshot-automation.md` | 変更 | PR2 | 暗号資産口座の実名（3か所）を「完全一致で判定する口座」に置き換え |
| `docs/investment-system-architecture.md` | 変更 | 本設計コミットで実施済み | 取込対象の金融機関一覧の行を「一覧は公開しない・非公開設定が正本」に置き換えた |

## 5. 触ってはいけない範囲
- **除外の判定結果**（どの口座が除外され、どの行が取り込まれるか）・`imported`・チェックサム（`verify`）の計算。変えるのは「設定の置き場所」と「公開コピーの中身」だけ。
- **KV `networth` に送る完全版**（`push_networth_to_worker()` に渡す doc）。実名の `institution`・`excludedAccounts` を残す（注文表の米ドル預り金判定が使う）。
- `mf-holdings.json` の**キーと形**（キーは消さず値を空にする）。`cat`/`name`/`value`/`cur`/`asOf`/`ySymbol`/`avgCost`/`price`/`qty`・`totals.mfNetWorth`/`imported` は一切変えない。
- `scripts/fetch_mf_history.py`（公開 config の `fetch` だけ読む。変更しない）。
- `fetch.realEstate.nameMap` の有効化（`update_real_assets()` が `data/real-assets/` を公開 commit しうるため、別設計まで非公開設定でも受け付けない）。
- ログイン処理（`with_page`/`do_setup`）・git commit/push 処理（`git_commit_push`）。
- アプリ（`src/**`）・Worker（`worker/**`）は触らない。
- 非公開設定の中身・実名を、PR・Issue・コミット・テスト・ログ・通知のどこにも書かない。

## 6. 受け入れ条件

### PR1（公開コピーから口座名を除去＋`--dry-run`）
- [ ] 品質ゲート green（vitest / eslint / prettier / check:types / check:circular / e2e、Python テスト）。
- [ ] `sanitize_for_public()` の戻り値で `totals.excludedAccounts == []`、全 `holdings[].institution == ""`。キー自体は残る。
- [ ] 引数の完全版 doc は変わらない（`institution`・`excludedAccounts` が元のまま）＝KV 送信内容は不変。
- [ ] 既存の除去（`liabilities`・負債/実物資産/計算純資産）と `qty` 保持のテストが通る。
- [ ] `run --dry-run` はファイル書き出し・`update_real_assets`・KV 送信・git を呼ばない（テストでモックして呼ばれないことを確認）。表示に実名・金額を含まない。
- [ ] **Mac 実機確認（マージ前）**: Mac mini で PR1 ブランチの `run --dry-run` を実行し、「公開コピー検査 OK（institution 非空 0 行・excludedAccounts 0 件）」「取込/除外の集合が直近出力と一致」「imported ±1% 以内」を確認。結果は OK/NG だけ報告。
- [ ] マージ後の即時確認（CLAUDE.md 手順 2〜4）: 翌回の `data: refresh MF holdings snapshot` で `excludedAccounts` が空・`institution` が全行空、`imported` と保有行数が前日と同程度。

### PR2（非公開ローカル設定の重ね合わせ＋公開 config の実名削除）
- [ ] 品質ゲート green。
- [ ] 公開 `data/mf-import-config.json` の `exclude.accounts == []`、`exclude.note`/`include.note` に実在の口座名・金融機関名が無い（reviewer が差分で確認）。
- [ ] `scripts/**`・`docs/**`・`tests/**` に実在の口座名・金融機関名が新たに入っていない。`_account_excluded()` にハードコードの口座名が無い。
- [ ] テスト（すべて架空名・合成値。非公開設定は一時ディレクトリに作り `private_path` か `MF_PRIVATE_CONFIG` で渡す）:
  - 重ね合わせあり: 架空の除外名で `build` → 除外行が落ち、`imported` が今のテストの期待値と同じ。
  - `=` 記法: `=テスト暗号口座` は「テスト暗号口座」だけを除外し「テスト暗号口座証券」は除外しない。`=` なしの「テスト交通系IC」は「家族のテスト交通系IC」も除外する。
  - 中止条件: ファイルなし／壊れた JSON／許可外キー（例 `fetch`・`checksum`）／`exclude.accounts` 空／公開側 `exclude.accounts` 非空 → それぞれ exit 6 相当（例外または SystemExit）で、`build` 以降・書き出し・KV 送信・git が呼ばれない。
  - 通知文に非公開設定の要素（架空名）が含まれない。
  - `setup` と `fetch_mf_history.py` は非公開ファイルなしで動く（`_load_cfg` 不変の確認）。
  - 退行防止: 公開 config の `exclude.accounts` が空であること（既存 `test_public_config_has_no_pii_mapping` に追加）。
- [ ] **macops 事前作業済み**（§7 手順 1）を PR 本文で確認できること（「作成済み・件数 N（実名なし）」の報告のみ）。
- [ ] **Mac 実機確認（マージ前）**: PR2 ブランチで `check-config` が OK、`run --dry-run` の件数と `imported` が main（PR1 済み）での `run --dry-run` と一致。非公開ファイルを一時的に別名にして `run --dry-run` が中止（exit 6・通知）することを確認し、元に戻す。
- [ ] マージ後の即時確認: 翌回（または kickstart）の snapshot コミットで保有行数・`imported` が前日と同程度、公開ファイルに実名なし。

## 7. 移行手順（PR2 の前後）

1. **macops（Mac mini・PR2 マージ前）**: 今の公開 config の `exclude.accounts` 7件を写して `~/.mf-snapshot/private-config.json` を作る（形は §3.1）。**暗号資産口座の1件だけは先頭に `=` を付ける**（今コードで完全一致にしている特例をこの記法に移すため。付け忘れると部分一致になり、取り込むべき口座まで除外される恐れがある）。`chmod 600`。中身はチャット・Issue・PR に貼らず、「作成済み・件数 7（うち完全一致 1）」とだけ報告する。バックアップは Mac のパスワード管理ツール等リポ外に置く。
2. PR1 がマージ済みであること（公開 `mf-holdings.json` から実名が消えている）。
3. Mac mini で PR2 ブランチを checkout し、`check-config` → `run --dry-run` を実行（§6 PR2 の Mac 確認）。結果は OK/NG と件数だけ報告。終わったら main に戻す。
4. Toshio 確認 → reviewer がマージ。
5. マージ後の即時確認（CLAUDE.md「クラウドから実行できないもの」手順 1〜5）: Toshio が `launchctl kickstart -k gui/$(id -u)/com.toshio.mf-snapshot`、PM が snapshot コミットの形・件数・実名なしを確認。中止通知（exit 6）が出たら非公開ファイルのパス/形を直す（公開側には何も書かれないので revert は不要）。

**マージ前 Mac 確認の例外に当たるかの判定**:
- **PR1: 当たる**。公開用の除去処理 `sanitize_for_public()` そのものを変えるため（CLAUDE.md が例外として明記）。
- **PR2: 当たる（例外扱いにする）**。設定の読み込みは文言上の例外（ログイン・取得・除去・自動 commit/push）に直接は含まれないが、誤ると除外が外れた保有が初回 run で公開 commit される＝マージ後の revert では取り消せない。除去処理と同じ重さとして、マージ前に `--dry-run` で確かめる。

## 8. PR 分割

| PR | 内容 | 依存 | Toshio 確認 | Mac 実機（マージ前） | Worker デプロイ | macops 依頼 |
|---|---|---|---|---|---|---|
| PR1 | `sanitize_for_public()` で `excludedAccounts`・`institution` を空に＋`run --dry-run` | なし | 要（資産データ・公開/非公開の境界・`data/mf-holdings.json` の値の変更） | 要（`--dry-run`） | 不要 | dry-run の実行 |
| PR2 | 非公開設定の重ね合わせ・中止条件・`=` 記法・`check-config`・公開 config の実名削除・README/routine/handoff の実名削除 | PR1 | 要（`scripts/fetch_mf.py`・`data/mf-import-config.json` の判定仕様） | 要（`check-config`＋`--dry-run`＋中止の確認） | 不要 | 非公開設定の作成（事前）・dry-run・中止の確認 |

- PR1 を先にする理由: 毎日の公開 commit で実名が出続けているのを最短で止める（変更が小さく、設定の移行を待たない）。
- PR1 は `Refs #687`、PR2 は `Closes #687`。
- `index.html` の `?v=` bump は不要（アプリ側の変更なし）。

## 9. git 履歴に残る実名の扱い（Toshio 判断）

現在のファイルから消しても、過去のコミットには残る（`data/mf-import-config.json` の各版、`data/mf-holdings.json` の毎日の版、一部の docs）。選択肢:

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| A 残す | 現在のファイルから消すだけ | 破壊的操作なし。clone 済みの環境（Mulmo のサンドボックス等）に影響なし | 履歴をたどれば読める（2026-06 から公開済み） |
| B 文字列置換で書き換える | `git filter-repo --replace-text`（置換リストは Mac 上の非公開ファイル）で全履歴の実名を架空の文字列に置き換え → force-push | 履歴からも読めなくなる | force-push・main 保護の一時解除が要る（CLAUDE.md の「確認してから実行」）。全コミットのハッシュが変わる。fork・既存 clone・外部キャッシュからは消せない。`data/mf-holdings.json` は毎日の版があるのでパス削除ではなく文字列置換が要る |

- 前例: #589 Phase1 の履歴パージ（`data/real-assets/*` をパス単位で削除・2026-07-20 実施）。B を選ぶ場合も同じ手順（フルクローン・置換・force-push・Mulmo 側 clone の再同期）で、**PR1・PR2 のマージ後**に1回だけ行う（先にやると、その後の毎日の commit でまた入るため）。
- 置換リスト（実名→架空名）は Mac 上で作り、リポにも Issue にも置かない。

## 10. Toshio に決めてほしいこと
- **Q1**: git 履歴の扱い（§9 の A か B）。
- **Q2**: 公開 `mf-holdings.json` で `institution` を空文字にする方式でよいか（キーは残す）。代わりに「キーごと削除」「架空の通し番号（口座1/口座2…）にする」も可能。既定は空文字。
- **Q3**: 公開 `mf-holdings.json` の `institution`・`excludedAccounts` を読んでいる外部の利用者（Mulmo の日次バッチ・他ツール）がいないか。リポ内の正本 docs には参照が無い。使っているなら Mulmo 向けに提案 Issue を別途起票する。
- **Q4**: 非公開設定が無いときに `run` を中止する（その日の公開 snapshot が更新されない）方針でよいか。既定は中止。
