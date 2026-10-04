# git 履歴の実名・非公開化した金額を置き換える手順書（#687 Q1＝B の続き）

- **Issue**: #707 `git 履歴の実名を文字列置換で書き換える（手順案）`（親: #687）
- **区分**: 設計案（手順案）。**実行はまだしない**。実施日時と §11 の決定を Toshio がした後、実施直前に再確認してから行う。
- **サイズ**: L 相当の運用作業（アプリのコード変更なし・実装 PR なし）。破壊的操作（全履歴の書き換え＋force push）を含む。
- **分担**: 設計＝architect（本書）／実行＝クラウドの PM・Mac セッション・Toshio（§4）。implementer・reviewer の出番は無い（§10）。
- **Toshio 確認**: **要**。force push（CLAUDE.md「確認してから実行」）、資産データの公開/非公開の境界、Mac セッションの禁止事項への一回限りの例外（§4.2）を含む。
- **公開リポの前提**: 本書・Issue・コメント・コミット・GitHub サポートへの依頼文・Mac セッションの出力に、**実名（口座名・金融機関名・家族名・勤務先名・物件名）と実額を書かない**。置換リストは Mac mini の上だけで作り、リポにもチャットにも出さない。出してよいのは件数・番号・パス・コミット SHA・成否だけ。

## 実装ログ（実施時に PM が更新）
- [ ] §11 の決定（Toshio）
- [ ] フェーズ0（準備・前日まで）完了: 候補 ＿件 → 確定 ＿語、リハーサルの残 0 件、HEAD ツリー一致
- [ ] フェーズ1（当日）完了: force push 日時 ＿＿、新 main ＿＿（SHA）、PR 影響数 ＿、first changed commits ＿件
- [ ] 書き手の再開（Mac mini・Mulmo・Actions）完了
- [ ] フェーズ2: GitHub サポート依頼 ＿＿／フォーク ＿＿／Issue・PR 本文 ＿＿／+1日・+7日の再検査 ＿＿／バックアップ削除 ＿＿

---

## 1. 背景・ゴール

### 背景
#687 の PR1（公開コピーから口座名を除去）と PR2（非公開ローカル設定への移設）はマージ済み。2026-10-04 時点の main で、公開 `data/mf-import-config.json` の `exclude.accounts` は 0 件、公開 `data/mf-holdings.json` の `holdings[].institution` は全行が通し番号（`口座N`）、`totals.excludedAccounts` は 0 件であることを確認した。

ただし **過去のコミットには実名が残っている**（#687 設計書 §9）。2026-10-04 Toshio 決定で Q1＝**B（履歴も文字列置換で書き換える）**。本書はその手順案。

残っている場所（種類のみ）:

| 場所 | 中身（種類） | 履歴上の版の数（目安） |
|---|---|---|
| `data/mf-holdings.json` の毎日の版 | `holdings[].institution`（取込対象の全口座の金融機関名。家族名入りの口座名を含む）、`totals.excludedAccounts`（除外した口座の実名） | このファイルに触れたコミットは main だけで約 100 |
| `data/mf-import-config.json` の各版 | `exclude.accounts`（家族名入りの交通系IC名・勤務先の持株会名・暗号資産口座名など）、`exclude.note`/`include.note`（銀行・信金名、子どもの NISA 口座名、信託銀行名など自由文） | 数十 |
| コード・docs の旧版 | `scripts/fetch_mf.py` のハードコード、`scripts/README-mf-snapshot.md`、`docs/routine_mf_*.md`、`docs/handoff/2026-06-21-mf-snapshot-automation.md`、`docs/investment-system-architecture.md` の旧版 | 数十 |
| Mulmo の Briefing（`data/briefings/**`）やコミットメッセージ | 口座名・金融機関名が混ざっている可能性（未調査。§6 の検査で数える） | 不明 |

main の全コミット数は約 1,040。リポのサイズは約 5 MB。

### なぜパス削除ではなく文字列置換か
#589 は `data/real-assets/*` をパスごと消した。今回の実名は **今も使っているファイル**（`data/mf-holdings.json`・`data/mf-import-config.json`・docs・コード）の過去の版の一部に入っている。パスごと消すとこれらのファイルの履歴（資産推移やコードの変遷）がまるごと失われ、HEAD のファイルまで消える。そこで `git filter-repo --replace-text`（全 blob の文字列置換）と `--replace-message`（コミットメッセージの置換）を使い、実名だけを架空の文字列に置き換える。

### ゴール
1. GitHub 上の全ブランチ・タグの全コミット（blob・コミットメッセージ・作者/コミッタ欄・パス名）で、置換リストの語が **0 件**。
2. HEAD のツリーは書き換え前と **同一**（現在のファイルはすでに実名なし）。CI が green。
3. 置換リストと候補一覧は Mac mini のリポ外（`~/history-rewrite/private/`）にだけ存在し、作業後に消す。
4. 自動の書き手（Actions・Mac mini の MF 取込・Mulmo・Worker）が、書き換え後の履歴の上で通常どおり動く。古い履歴が main に戻ってこない。
5. GitHub 側に残る古いコミット（PR の参照・SHA 直打ち・キャッシュ）を、GitHub サポートへの依頼で消す（§8）。

### 範囲外
- **現在も公開している金額**（`mf-holdings.json` の `holdings[].value`・`totals.mfNetWorth`/`imported`、`mf-history.json` の系列、`positions.json`、`portfolio-snapshot.json`）。今も毎日公開している種類の値なので、履歴だけ書き換えても意味がない。非公開にしたいなら、先に公開をやめる別設計が要る（**要 Toshio 判断・§11 Q3**）。
- 現行の仕様値として docs に書いてある金額パラメータ（例: `docs/wealth-networth-spec.md` の生活資金の固定値）。外したい場合は別途（§11 Q3 で併せて確認）。
- Toshio 本人の名前・メールアドレス（コミット作者として公開済みの ID）。
- アプリ・Worker・ワークフローのファイル変更（なし）。

## 2. 方針の要点

| 項目 | 決定 |
|---|---|
| ツール | `git filter-repo`（2.47 以上。`--sensitive-data-removal` を使うため）。`--replace-text` と `--replace-message` に同じ置換リストを渡す |
| 置換後の文字列 | 語ごとに `非公開NN`（NN は置換リスト内の番号・2桁）。金額は `非公開額`。JSON を壊さない文字だけを使う。現在の `口座N`（PR1 の通し番号）とは別の形にして混同を避ける |
| 置換リストの作り方 | Mac mini 上でスクリプトが候補を集め（§5）、**Toshio が自分の端末で目を通して確定**する。Claude（Mac セッション）は件数しか見ない |
| 金額の扱い | 負債・不動産評価・計算純資産（#589 で非公開化した種類）は、まずキーの有無を数えて残っていないことを確かめる（§5.4）。残っていたら止めて設計に戻す。Toshio が特に消したい実額があれば任意で置換リストに足す（§5.3） |
| 実行場所 | Mac mini の `~/history-rewrite/`（リポ外・`chmod 700`）。`~/GitHub/portfolio`（MF 取込の作業コピー）では実行しない |
| force push | 既定は **Toshio が Termius から自分で実行**（§4.1）。Mac セッションに任せる場合は Toshio が一回限りの許可を出す（§11 Q1） |
| 実施時間帯 | 09:00〜14:00 UTC（17:00〜22:00 CST・Mac mini の時刻）。§9 |
| GitHub サポート | 依頼する（推奨）。古い SHA・PR の差分・キャッシュを消してもらう。代わりに過去 PR の差分表示が見られなくなる（§8・§11 Q5） |

## 3. 自動の書き手と、止め方・戻し方

時刻は UTC（括弧内は CST＝UTC+8・Mac mini の時刻）。

| 書き手 | いつ書くか | 書き換え中の扱い | 止め方 | 戻し方 | 戻す前に必要なこと |
|---|---|---|---|---|---|
| Actions `per-daily.yml` | 毎日 20:15（04:15） | 止める | PM が `gh api -X PUT repos/shoulang0729/portfolio/actions/workflows/per-daily.yml/disable`（権限が無ければ Toshio が Actions 画面の「Disable workflow」） | 同じ API の `/enable` | なし（毎回 fresh checkout なので新しい履歴で動く） |
| Actions `weekly-valuations.yml` | 日曜 02:00（10:00） | 止める | 同上 | 同上 | なし |
| Actions `fund-holdings-monthly.yml` | 毎月 1〜20 日 03:00（11:00） | 止める | 同上 | 同上 | なし |
| Actions `kv-resync.yml` | 毎日 23:30（07:30）＋`data/valuations.json` の push 時 | 止める（force push で push イベントが起きるため） | 同上 | 同上 | なし |
| Actions `build-dist.yml`・`test.yml`・`e2e.yml` | main への push 時 | **止めない**。force push 後の CI として使う（`build-dist` は差分が無ければ commit しない） | — | — | — |
| Actions `mf-freshness.yml` | 毎日 00:40（08:40）。commit しない | 止めない（窓の外。MF 取込を翌朝までに戻すので誤報は出ない） | — | — | — |
| Mac mini の MF 取込（launchd `com.toshio.mf-snapshot`） | 毎朝 21:00（05:00）＋再試行 | 止める（古い作業コピーのまま走ると、rebase で古い履歴を持ち込もうとして失敗するか、最悪 push する） | Mac セッションが `launchctl bootout gui/$(id -u)/com.toshio.mf-snapshot`（MF 推移の取得が別ジョブなら同様。事前に `launchctl list \| grep com.toshio` でラベルを確認） | `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.toshio.mf-snapshot.plist` | **`~/GitHub/portfolio` の取り直し（§7.1）が先** |
| Mulmo の日次バッチ（`data/valuations.json`・`data/briefings/**`） | 毎朝 21:00（05:00） | 窓の外だが、**次回の実行前に Mulmo 側の作業コピーの取り直しが必須** | Toshio が Mulmo に事前連絡（§7.2 の文面）。取り直しが 21:00 UTC までに済まないなら、その回の実行を止めてもらう | Mulmo が取り直し完了を報告 | §7.2 |
| Worker Cron のスナップショット（`data/portfolio-snapshot.json`・GitHub Contents API） | 01:00・08:00・15:00・22:00（09:00・16:00・23:00・06:00） | 止めない。窓（09:00〜14:00）は 08:00 と 15:00 の間 | — | — | なし（毎回その時点の main の上に commit するので、古い履歴を持ち込まない） |
| Worker の `PUT /positions`（`data/positions.json`）・手動スナップショット | アプリで取込・スナップショット保存をした時 | 窓の間は使わない（Toshio） | Toshio がアプリの取込・スナップショット保存を操作しない | — | なし |
| クラウドの Claude Code セッション（implementer 等） | 随時 | 窓の間は起動しない。窓の前に push 済みでない作業は捨てるか、窓の後に新しい main へ cherry-pick する（**merge しない**） | PM が新規の実装を出さない。開いている PR を 0 にしておく（§6.0） | 窓の後、作業コピーを取り直してから再開 | §7.3 |

**取り込んではいけない操作**: 古い作業コピーでの `git pull`（merge）。古い履歴まるごと main に戻る。ログに `Merge remote-tracking branch 'origin/main'` の commit が過去にあるので、どこかの書き手が merge で pull する設定になっている可能性を前提に、全作業コピーの取り直しを再開の条件にする。

## 4. 誰が何をするか

| 担当 | すること | しないこと |
|---|---|---|
| **クラウドの PM**（親セッション） | 事前確認（開いている PR・ブランチ・フォーク・main の保護）、Actions の停止/再開、旧 main の SHA とツリーの記録、force push 後の構造検査（§6.4。置換リストを使わない検査）、Issue へのコメント、GitHub サポート依頼文の下書き、Mac セッションへの指示（`create_session`）、+1日・+7日の検査の起動 | 置換リスト・候補の中身を見る・受け取ること。force push |
| **Mac セッション**（Mac mini 上の Claude・一回限りの例外つき・§4.2） | `~/history-rewrite/` の作成、バックアップのミラー clone、候補の収集・置換リストの組み立て・検査（スクリプト実行・**件数だけ報告**）、リハーサルと本番の filter-repo、`~/GitHub/portfolio` の取り直し、launchd の停止/再開、結果を Issue にコメント | 置換リスト・候補・非公開設定・blob の中身を表示すること（`cat`・`less`・`git show`・`grep` で一致行を出す等すべて）。force push（既定。§11 Q1 で許可された場合のみ）。`sudo`。`~/GitHub/portfolio` での filter-repo |
| **Toshio** | §11 の決定、Mulmo への連絡、候補一覧の目視と置換リストの確定（**自分の端末だけで**）、`git filter-repo` のインストール（必要なら）、main の保護の一時解除と戻し、**最終承認（Go）と force push の実行**、GitHub サポートへの依頼の送信、フォークの削除（自分の管理下なら）、自分の手元の作業コピーの取り直し | 置換リストや候補をチャット・Issue に貼ること |

### 4.1 force push を誰がやるか（判断）
- **既定: Toshio が Termius から実行する**。理由: (1) CLAUDE.md「`git push --force` は確認してから実行」を、本人が実行することで最も確実に満たす。(2) Mac セッションの禁止事項（push 禁止）を崩さずに済む。(3) 打つのは Mac セッションが用意した 1 本のスクリプト（§6.3 の `push.sh`）だけで、事前検査を内蔵しているので手作業の誤りが入りにくい。
- クラウドの PM が push しない理由: 書き換えた履歴をクラウドへ運ぶには置換後のリポを Mac から出す必要があり、置換前後の対応（どこを何に変えたか）が Mac の外に出る。また PM の作業コピーは古い履歴を持っている。
- Mac セッションに任せる案（§11 Q1 の B）: 可能だが、その場合は §4.2 の許可文に「§6.3 の `push.sh` を 1 回だけ実行してよい」を足す。

### 4.2 Mac セッションへの一回限りの例外（承認のしかた）
CLAUDE.md「Mac セッション」の禁止事項は「リポのファイル編集・commit・push」「Secrets 等の表示」。本作業は (a) リポ外の別 clone で履歴を書き換える、(b) `~/GitHub/portfolio` を `git reset --hard` で取り直す（CLAUDE.md「確認してから実行」）、(c) launchd の停止/再開、(d) `brew install git-filter-repo`（必要なら）を含み、許可済み作業の一覧に無い。

- **CLAUDE.md は変えない**（一回限りの作業のため）。代わりに、**Toshio が自分のメッセージで**次の文を PM に送り、PM はそれを本 Issue にコメントとして残し、`create_session` の prompt にそのまま入れる。エージェントからのメッセージは承認にならない。
- Mac 側で権限確認に止まったら、PM は権限を足さず Toshio に報告する（Toshio が Mac 側で許可する）。

> 許可文（案）: 「Issue #707 の手順書 `docs/handoff/2026-10-04-history-rewrite.md` のフェーズ0〜1・§7.1 に限り、Mac セッションが次を行うことを許可する: `~/history-rewrite/` 配下での clone・ミラー clone・`git filter-repo` の実行と検査スクリプトの実行、`launchctl bootout/bootstrap`（`com.toshio.mf-snapshot`）、`~/GitHub/portfolio` の `git fetch`＋`git reset --hard origin/main`＋古いローカルブランチの削除＋`git gc`、（必要なら）`brew install git-filter-repo`。push は含まない［※Q1＝B のときは『§6.3 の push.sh を 1 回だけ実行してよい』を足す］。置換リスト・候補・非公開設定・blob の中身は表示しない。期限は ＿＿（実施日）まで。」

## 5. 置換リストの作り方（値をどこにも表示しない）

### 5.1 置き場所とルール
```
~/history-rewrite/            (chmod 700)
├── bin/                      スクリプト（本書 §12 の内容をコピー。値は含まない）
├── private/                  (chmod 700) 候補・置換リスト。中身は Toshio だけが見る
│   ├── candidates-auto.tsv   自動収集した候補（語・出どころ・短語フラグ）
│   ├── notes-review.txt      過去の config の note 自由文（実名が混ざる。Toshio が読む）
│   ├── terms-final.txt       Toshio が確定した語（1行1語。金額は AMOUNT: を前置）
│   └── replacements.txt      filter-repo に渡す形（build_replacements.py が作る）
├── state/                    旧 main の SHA・リモートのブランチ一覧・件数の記録（値なし）
├── backup-YYYYMMDD.git       ミラー clone（バックアップ。実名を含む）
├── rehearsal/                リハーサル用 clone
└── work/                     本番用 clone
```
- `private/` のファイルは `chmod 600`。スクリプトの標準出力は件数・番号・パスだけ。例外発生時も例外の型名だけを出す。
- Mac セッション（Claude）は `private/` のファイルを開かない。スクリプトの中で読むのは可。
- 作業完了＋GitHub サポートの処理完了の後、`private/` とバックアップを消す（§8.4）。

### 5.2 候補の出どころ（`collect_candidates.py` が自動で集める）
| 出どころ | 集める値 | 印 |
|---|---|---|
| `~/.mf-snapshot/private-config.json` | `exclude.accounts`（先頭の `=` は外す）、`liabilityAccountMap` のキー | P |
| 過去の公開 `data/mf-import-config.json` の全版（全 ref） | `exclude.accounts`（`=` は外す）、`liabilityAccountMap` のキー、`fetch.realEstate.nameMap` のキーと値 | C |
| 同上の `note` を含むキーの自由文 | 候補には入れず `notes-review.txt` に出す（Toshio が読んで語を抜き出す） | — |
| 過去の公開 `data/mf-holdings.json` の全版（全 ref） | `holdings[].institution`、`totals.excludedAccounts`、`liabilities[]` の `institution`/`name`/`account`/`bank` | H / L |

- 現在の通し番号（`口座N`）・空文字は候補から外す。
- ファイルの改名に備え、ファイル名の末尾が一致するパスを全部たどる。
- 4 文字未満の語に `SHORT` の印を付ける（一般語と衝突しやすい）。

### 5.3 Toshio の確定作業（Toshio の端末だけで・Termius 等）
1. `less ~/history-rewrite/private/candidates-auto.tsv` と `notes-review.txt` を読む。
2. `terms-final.txt` を作る（`nano` 等）。
   - 候補から **一般語を外す**（例: カテゴリ名や「財布」「現金」のような MF の汎用名。ブランド名でも一般名詞として docs に出てくるものは、§5.5 の件数を見て判断）。
   - note の自由文から実名を抜き出して足す（取り込みに戻した銀行・信金名、信託銀行名、子どもの NISA 口座名など）。
   - 単独で出てくる可能性がある語を足す（家族の名前、勤務先の名前、物件名）。口座名の一部として入っている語も、単独で docs・コミットメッセージ・Briefing に出ている可能性があるため。
   - 任意: 特に消したい実額（docs やコミットメッセージに書いたことがあるもの）を `AMOUNT:<文字列>` で足す。表記ゆれ（`12,345,678` と `12345678` と `1,234万`）は別々の行にする。7 桁未満の数字は他の数値と衝突しやすいので入れない。
3. Mac セッションに「確定した」とだけ伝える（語数も Mac セッションが数えて報告する）。

### 5.4 金額キーの残り確認（`amount_keys.py`）
#589 で非公開化した種類（負債・実物資産・計算純資産）が履歴に残っていないかを、**値を見ずにキーの有無だけで**数える。
- 期待値: `real_assets_json_paths_in_history=0`、`liabilities=0`、`liabilitiesTotal=0`、`realAssetsTotal=0`、`netWorthComputed=0`。
- **0 でなければ止めて architect に戻す**（その場で対処を足さない）。戻った場合の案: filter-repo の `--file-info-callback` で `mf-holdings.json` の該当キーだけ削る別パスを足す（値のリスト不要）。

### 5.5 準備の流れとリハーサル（停止不要・前日まで）
準備（Mac セッション。出力は件数だけ）:
1. `mkdir -m 700 -p ~/history-rewrite/{bin,private,state}` → §12 のスクリプトを `bin/` に置く。
2. `git clone --mirror https://github.com/shoulang0729/portfolio.git ~/history-rewrite/prep.git`（準備用。本番のバックアップは当日取り直す）
3. `python3 bin/collect_candidates.py prep.git private` と `python3 bin/amount_keys.py prep.git` → 件数を Issue に報告。
4. Toshio が §5.3 の確定作業 → `python3 bin/build_replacements.py private`。

リハーサル:
1. `git clone --no-local ~/history-rewrite/prep.git ~/history-rewrite/rehearsal`（ブランチ数は clone のしかたで `compare.sh` の値がずれることがある。リハーサルでは HEAD ツリーと main のコミット数を見る）
2. `build_replacements.py` → `scan.py rehearsal`（書き換え前の件数。語ごとに `#NN blob=… head=… msg=… path=… 例: <パス>`）
3. `git -C rehearsal filter-repo --replace-text ../private/replacements.txt --replace-message ../private/replacements.txt --force`
4. `scan.py rehearsal` → `total_hits=0` を確認。`compare.sh prep.git rehearsal`（HEAD ツリー一致・コミット数・ブランチ数）
5. 見るべき点:
   - **`head=` が 0 でない語** ＝ 現在のファイルを書き換えてしまう語（一般語の誤爆か、まだ HEAD に実名が残っている）。Toshio が確認し、誤爆なら `terms-final.txt` から外す。HEAD に実名が残っているなら、先に通常の PR で消す（書き換えはその後）。
   - 語ごとの件数が想定より極端に多い（例: 数百のファイル）＝誤爆の疑い。例のパスで判断する。
   - `email_domains_outside_allowlist` が 0 でない ＝ 作者/コミッタのメールに想定外のドメインがある。Toshio が自分の端末で確認し、勤務先などなら `--mailmap` の追加を architect に相談する。
6. ゴール: `total_hits=0`、`HEAD tree: identical`、コミット数の差は 0（filter-repo が空になったコミットを落とした場合は件数を報告）。

## 6. 当日の手順

### 6.0 事前確認（前日まで・PM）
- [ ] 開いている PR が 0（あればマージかクローズ。書き換え後は旧履歴ベースの PR は使えない）。
- [ ] 残すブランチを決める。2026-10-04 時点で `main` 以外に 3 本（`auto-fix/20261003`・`issue-assets`・`fix/687-mf-public-sanitize-institution`）。不要なら削除（Toshio 確認）。タグは 0。
- [ ] main の保護・ルールセットで force push が禁止されているか（PM の権限では読めなかった。Toshio が Settings で確認）。禁止なら当日 Toshio が一時解除。
- [ ] フォーク 1 件（2026-06 作成・同月中旬が最後の push）の扱い（§11 Q4）。
- [ ] Mac mini の `git filter-repo --version` が 2.47 以上（無ければ Toshio が `brew install git-filter-repo`）。
- [ ] フェーズ0（§5）が終わり、リハーサルが合格。
- [ ] Toshio が §4.2 の許可文と実施日時を PM に送り、PM が Issue に記録。Mulmo へ事前連絡（§7.2）。
- [ ] このドキュメントを含む docs の commit がすべて push 済み（書き換え後に古い履歴の上で commit しない）。

### 6.1 停止（T−15 分）
| 順 | 担当 | 作業 | 合格の基準 |
|---|---|---|---|
| 1 | PM | Actions 4 本（`per-daily`・`weekly-valuations`・`fund-holdings-monthly`・`kv-resync`）を disable | 4 本とも `state=disabled_manually` |
| 2 | PM | 実行中の Actions が無いことを確認 | in_progress / queued が 0 |
| 3 | Mac セッション | `launchctl bootout gui/$(id -u)/com.toshio.mf-snapshot`（他に main へ書くジョブがあれば同様） | `launchctl list` に出ない |
| 4 | Toshio | アプリで取込・スナップショット保存をしないことを了解。Mulmo が実行中でないことを確認 | — |
| 5 | PM | 旧 main の SHA と `main^{tree}` を Issue に記録（`gh api repos/shoulang0729/portfolio/commits/main`） | 記録済み |
| 6 | Toshio | main の保護を一時解除（必要な場合のみ） | — |

### 6.2 書き換え（Mac セッション・`~/history-rewrite/`）
```bash
cd ~/history-rewrite
D=$(date +%Y%m%d)
# 1) バックアップ（PR の参照 refs/pull/* も含む全 ref）
git clone --mirror https://github.com/shoulang0729/portfolio.git backup-$D.git
git -C backup-$D.git rev-parse main > state/old-main.txt
git -C backup-$D.git rev-parse 'main^{tree}' > state/old-tree.txt
git ls-remote https://github.com/shoulang0729/portfolio.git 'refs/heads/*' 'refs/tags/*' > state/remote-refs-before.txt
# 2) 本番用 clone（通常の clone。--sensitive-data-removal が PR の参照も取りに行く）
git clone https://github.com/shoulang0729/portfolio.git work
# 3) 書き換え
git -C work filter-repo --sensitive-data-removal \
  --replace-text ../private/replacements.txt \
  --replace-message ../private/replacements.txt
# 4) サポート依頼用の数字（SHA と件数だけ）
grep -c '^refs/pull/.*/head$' work/.git/filter-repo/changed-refs > state/affected-prs.txt
cp work/.git/filter-repo/first-changed-commits state/ 2>/dev/null || true
```
- PR の参照が取得されなかった場合（`changed-refs` に `refs/pull/` が 0 件で、かつ PR が存在する）は、2) の後に `git -C work fetch origin '+refs/pull/*:refs/pull/*'` を足してやり直す。
- filter-repo が `origin` を外した場合は、6.3 の `push.sh` が付け直す。
- 報告（Issue へ）: 旧 main の SHA、`affected-prs` の件数、first changed commits の件数と SHA（SHA は公開してよい）。

### 6.3 検査 → 承認 → force push
**検査（Mac セッション）** — すべて合格するまで次へ進まない。
| 検査 | コマンド | 合格の基準 |
|---|---|---|
| 語の残り | `python3 bin/scan.py work private` | `total_hits=0`（blob・コミットメッセージ・作者/コミッタ・パス・ref 名のすべて） |
| 金額キー | `python3 bin/amount_keys.py work` | すべて 0（§5.4） |
| HEAD の同一性 | `bash bin/compare.sh backup-$D.git work` | `HEAD tree: identical`。コミット数・ブランチ一覧が書き換え前と同じ（差があれば件数を報告し、Toshio が判断） |
| ビルド・テスト | HEAD ツリーが同一なら、現 main（CI green）と同じ内容なので省略可。同一でない場合は `work` で `npm ci && npm test && npm run lint` と `python3 -m pytest tests/` を実行 | green |

**承認（Toshio）**: 検査結果のコメントを見て、Toshio が PM に「force push してよい」と自分のメッセージで伝える（PM は Issue に記録）。

**force push（既定: Toshio が Termius で `bash ~/history-rewrite/bin/push.sh` を実行）**。`push.sh` の中身は §12。やること:
1. `work` に `origin` が無ければ付け直す。
2. 現在のリモートのブランチ/タグが `state/remote-refs-before.txt` と同じかを確かめる（窓の間に誰かが push していたら **中止**。その場合は 6.2 の clone からやり直す。filter-repo は 1 分程度で終わる）。
3. `git push --force origin 'refs/heads/*:refs/heads/*'` と（タグがあれば）`'refs/tags/*:refs/tags/*'`。`refs/pull/*` は GitHub が拒否するので push しない（§8 でサポートに依頼）。
4. push 後の `git ls-remote` で main が `work` の main と一致することを表示する。

### 6.4 push 後の検査
| 担当 | 検査 | 合格の基準 |
|---|---|---|
| PM（クラウド・置換リストなし） | 新しく clone（`--no-single-branch`）して `main^{tree}` を 6.1 で記録した旧ツリーと比べる | 一致 |
| PM | 旧 main の SHA が新 main の祖先でない（`git merge-base --is-ancestor <旧SHA> origin/main` が偽。新しい clone に旧コミットが無ければ「無い」で合格） | 祖先でない |
| PM | ルートコミットが 1 個、ブランチ一覧が想定どおり | — |
| PM | force push で走った `test.yml`・`e2e.yml`・`build-dist.yml` が green（build-dist が commit を足していれば、それも新しい履歴の上であること） | green |
| Mac セッション | `~/history-rewrite/verify` に新しく `git clone --mirror` して `scan.py` | `total_hits=0` |
| PM | GitHub Pages の本番 URL が開ける（ビルドの完了を待つ） | 表示される |

### 6.5 再開（この順で）
1. **Toshio**: main の保護を戻す（解除した場合）。
2. **Mac セッション**: `~/GitHub/portfolio` を取り直す（§7.1）→ `launchctl bootstrap …`。必要なら Toshio の依頼で `kickstart` を 1 回行い、`data: refresh MF holdings snapshot` が新しい履歴の上に積まれることを PM が確認（CLAUDE.md「マージ直後に即時確認」と同じ手順）。
3. **Mulmo**: 取り直し完了の報告を Toshio 経由で受ける（**21:00 UTC の次回実行より前が期限**）。間に合わなければその回の実行を止めてもらう。
4. **PM**: Actions 4 本を enable。
5. **PM**: クラウド側の古い作業コピー・worktree を使わない（新しいセッションは clone し直す）。Issue に完了を記録。
6. **Toshio**: 自分の手元の作業コピーを取り直す（§7.3）。

## 7. 作業コピーの取り直し

共通の原則: **古い作業コピーで `git pull` しない**（merge で古い履歴が戻る）。必ず `fetch` → `reset --hard` か、clone し直す。古い履歴の上で作ったブランチは捨てるか、必要な commit だけを新しい main へ cherry-pick する。

### 7.1 Mac mini `~/GitHub/portfolio`（MF 取込の作業コピー・Mac セッション）
未追跡ファイル（仮想環境・ローカル設定など）を残すため、clone し直しではなく取り直しにする。
```bash
cd ~/GitHub/portfolio
git status --porcelain | wc -l                 # 変更中のファイル数（0 でなければ中止して報告）
git log --oneline origin/main..main | wc -l    # push していない commit の数（報告。旧履歴上の取込結果なので捨ててよい）
git fetch origin --prune
git checkout main && git reset --hard origin/main
git for-each-ref --format='%(refname:short)' refs/heads | grep -vx main | xargs -r git branch -D
git reflog expire --expire=now --all && git gc --prune=now
git rev-parse 'HEAD^{tree}'                    # 6.1 で記録した旧ツリーと一致すること
```
報告は件数と一致/不一致だけ。

### 7.2 Mulmo 側の作業コピー（Toshio が Mulmo に伝える文面の案）
> portfolio リポの git 履歴を書き換えて force push しました（日時 ＿＿、新しい main の先頭 SHA ＿＿）。次の日次バッチの前に、作業コピーを `git fetch origin --prune && git checkout main && git reset --hard origin/main` で取り直し、main 以外のローカルブランチを削除してください。**`git pull`（merge）はしないでください**（古い履歴が main に戻ります）。古い履歴の上で作った未 push の commit があれば捨てるか、新しい main に cherry-pick してください。完了したら `git rev-parse HEAD` の結果を ＿＿ に返してください。

### 7.3 Toshio の手元・クラウド
- Toshio の Mac / 他の端末: 7.1 と同じ（未追跡ファイルが無ければ clone し直しでもよい）。
- クラウドの Claude Code: セッションごとに clone されるので、窓の後に始めたセッションは自動で新しい履歴になる。窓の前から続いているセッション・worktree は使わない。

## 8. GitHub 側に残るもの

| 残り方 | 内容 | 対処 |
|---|---|---|
| PR の参照（`refs/pull/N/head`） | 過去の PR の head commit は利用者が書き換えられず、古いコミットと blob が PR の画面・差分から読める | **GitHub サポートに依頼**（§8.1）。依頼後は対象 PR の差分表示が見られなくなる |
| SHA 直打ちでのアクセス・キャッシュ | force push 後も GitHub の GC までは `…/commit/<旧SHA>` で見える | 同上（サポートがキャッシュ削除と GC を行う） |
| フォーク | 1 件（2026-06 作成・同月中旬に最後の push）。当時の履歴を持っている | フォーク元の Toshio が管理するアカウントなら、Toshio がフォークを削除（§11 Q4）。他人のものならサポート依頼に含めて相談 |
| Issue・PR の本文とコメント | git の書き換えでは変わらない。編集しても「edited」の履歴に旧文が残る | §8.2 |
| Actions のログ | 過去の実行ログに実名が出ている可能性は低い（データ系ジョブは件数中心） | 任意。気になる実行があれば Actions 画面で削除 |
| 外部のアーカイブ（Software Heritage・GH Archive・検索エンジンのキャッシュ） | 取得済みのものは GitHub の作業では消えない | 任意。Software Heritage には削除依頼の窓口がある。本手順の範囲外 |

### 8.1 GitHub サポートへの依頼（Toshio が送る・PM が下書き）
- 送る時期: force push と 6.4 の検査が終わり、フォークの扱いが決まった後。
- 本文に入れるもの（実名・実額は入れない）: リポ `shoulang0729/portfolio`、個人情報（人名・金融機関名）を `git filter-repo --sensitive-data-removal --replace-text` で全履歴から置き換え force push したこと、影響を受けた PR の数（`state/affected-prs.txt`）、first changed commits の SHA（`state/first-changed-commits`）、LFS は使っていないこと、依頼内容（キャッシュの削除・PR の参照の解除・GC）。
- 処理には日数がかかる。完了の連絡を受けたら、PM が旧 SHA の URL が 404 になることを確認する。

### 8.2 Issue・PR の本文とコメント（フェーズ2・任意だが推奨）
1. Mac セッションが `gh api --paginate` で全 Issue・PR の本文とコメントを `~/history-rewrite/private/gh-text/` に保存し、`scan.py` と同じ方法で語を数える。出力は Issue/PR 番号と件数だけ。
2. Toshio が該当箇所を GitHub 上で編集し、編集履歴から旧版を削除する（本文の「edited」メニューの「Delete revision」）。
3. 作業後 `gh-text/` を消す。

### 8.3 +1日・+7日の再検査
- PM: 新しい clone で「旧 main の SHA が main の祖先でない」「main の祖先にルートが 1 個」を確認（古い作業コピーからの merge による再混入の検知）。
- Mac セッション: 新しいミラー clone で `scan.py`（`total_hits=0`）。
- 再混入が見つかったら、PM はその commit を戻す PR を出さずに Toshio に報告する（混入した commit 以降を含めて再度書き換える必要があるため。手順は本書の 6.1 から）。

### 8.4 後片付け
- GitHub サポートの処理完了と +7日の検査の合格後に、Mac mini の `~/history-rewrite/private/`・`backup-*.git`・`prep.git`・`rehearsal/`・`work/`・`verify/` を削除する（バックアップは実名入りの旧履歴そのもの。既定の保管期間は §11 Q6）。
- 削除は Toshio が行うか、Mac セッションに依頼（`rm -rf` を伴うので Toshio の明示の依頼で）。

## 9. 実施のタイミングと所要時間

- **窓: 09:00〜14:00 UTC（17:00〜22:00 CST）**。この間に定時で main に書くものは無い（Worker Cron は 08:00 と 15:00、Actions は 20:15・23:30・日曜 02:00・月初 03:00、MF 取込と Mulmo は 21:00）。曜日はどこでもよい。
- Mulmo の作業コピーの取り直しを 21:00 UTC までに確実に終えられる日にする（Toshio が Mulmo と連絡が取れる日）。
- 所要時間（目安）:

| フェーズ | 内容 | 時間 | 停止 |
|---|---|---|---|
| 0 | 準備（候補収集・Toshio の確定・リハーサル） | 1〜2 時間（Toshio の目視を含む）。前日までに | 不要 |
| 1 | 停止 → 書き換え → 検査 → 承認 → force push → push 後の検査 | 1〜1.5 時間 | 要（窓の中） |
| 1 | 再開（Mac mini 取り直し・kickstart 確認・Actions 再開） | 30 分〜1 時間 | — |
| 2 | サポート依頼の処理・Issue/PR 本文・再検査・後片付け | 数日〜数週間（GitHub 側の処理待ち） | 不要 |

## 10. リスクと戻し方

| リスク | 起きること | 予防 | 戻し方 |
|---|---|---|---|
| 一般語の誤爆（過剰置換） | 現在のファイルや無関係な履歴の文字が `非公開NN` になる | リハーサルの `head=` と語ごとの件数・例のパスを Toshio が確認。本番でも HEAD ツリーの一致を必須にする | push 前: リストを直してやり直す。push 後: HEAD は一致を確認済みなので、影響は過去の版の表示だけ。直すなら、バックアップから正しいリストで作り直して再度 force push（Toshio 判断） |
| 置換漏れ（過少置換） | 自由文や単独の家族名・勤務先名が残る | note の自由文を Toshio が読む。単独語を足す。+7日の再検査 | 漏れた語を足して、もう一度同じ手順で書き換える（その分 force push とサポート依頼がもう一度要る） |
| 古い作業コピーからの再混入 | merge で古い履歴が main に戻る（実名が再公開） | 全書き手の停止と取り直しを再開の条件にする。Mulmo への明示の連絡。+1日・+7日の検査 | 混入を検知したら Toshio に報告し、混入後の main から再度書き換える（§8.3） |
| 窓の間の割り込み commit | force push で割り込んだ commit が消える（データ系なので次回の実行で再生成される） | 書き手の停止。`push.sh` がリモートの ref を事前に照合して、変わっていたら中止 | 中止したら 6.2 の clone からやり直す |
| 置換リストの露出 | 実名がチャット・ログ・Issue に出る | スクリプトは件数だけを出す。Mac セッションは `private/` を開かない。Toshio だけが目視 | 露出したら即 Toshio に報告。出た場所（コメント等）を削除し、編集履歴も削除 |
| SHA が変わることの影響 | Issue・PR・docs に書いた commit SHA のリンクが切れる。過去 PR の差分（サポート処理後） | 影響は表示だけ。アプリ・Worker・Actions は SHA に依存しない（Worker の Contents API は都度最新のファイル SHA を取る） | なし（受け入れる） |
| force push 自体の失敗 | 一部のブランチだけ更新される | `push.sh` が push 後に全 ref を照合 | 足りないブランチを再 push。全体を戻すならバックアップから `git push --force --mirror`（実名が再公開されるので、致命的な破損時だけ・Toshio 判断） |
| サポートが依頼を断る・時間がかかる | 古い SHA・PR から読める状態がしばらく続く | — | 受け入れる。フォーク削除と本文の編集は並行して進める |

## 11. Toshio に決めてほしいこと

- **Q1 force push の実行者**: A＝Toshio が Termius で `push.sh` を実行（推奨）／B＝Mac セッションに §4.2 の許可文で一回限り許可。
- **Q2 実施日時**: 窓（09:00〜14:00 UTC＝17:00〜22:00 CST）の中で、Mulmo と連絡が取れる日。
- **Q3 範囲外にした金額**: 現在も公開している金額（保有の評価額・MF の総資産・資産推移の系列・positions/snapshot）と、docs の金額パラメータ（生活資金の固定値）を範囲外にしてよいか。非公開にしたいなら、履歴の書き換えより先に公開をやめる別設計が要る（その場合は書き換えをその後に回す）。
- **Q4 フォーク 1 件**: Toshio が管理するアカウントのものなら削除してよいか。違うなら所有者への連絡かサポートへの相談か。
- **Q5 GitHub サポートへの依頼**: 依頼する（推奨。過去 PR の差分表示が消える）／しない（古い SHA と PR から読める状態が残る）。
- **Q6 バックアップの保管期間**: サポート処理完了と +7日の再検査の後に削除（推奨）／30 日保管してから削除。
- **Q7 Issue・PR の本文とコメント（§8.2）**: 本作業に含めるか、別 Issue にするか。
- 置換後の文字列（`非公開NN`・`非公開額`）は既定とする。別の形にしたければ指示を。

## 12. スクリプト（値を含まない。Mac セッションが `~/history-rewrite/bin/` にコピーして使う）

### collect_candidates.py
```python
#!/usr/bin/env python3
"""置換候補を集める。標準出力は件数だけ（値は private/ のファイルにだけ書く）。
使い方: python3 collect_candidates.py <mirror.git> <private_dir>"""
import json, os, re, subprocess, sys
from pathlib import Path

repo, outdir = sys.argv[1], Path(sys.argv[2])
PRIVATE_CFG = Path(os.environ.get('MF_PRIVATE_CONFIG', str(Path.home() / '.mf-snapshot/private-config.json')))
SKIP = re.compile(r'^(口座\d+|非公開\d+|非公開額)?$')

def git(*args):
    return subprocess.run(['git', '-c', 'core.quotePath=false', '-C', repo, *args],
                          capture_output=True).stdout

cands, notes = {}, set()
stats = {'versions': 0, 'parse_errors': 0}

def add(term, src, strip_eq=False):
    if not isinstance(term, str):
        return
    t = term.strip()
    if strip_eq:
        t = t.lstrip('=')
    if SKIP.match(t):
        return
    cands.setdefault(t, set()).add(src)

def walk_notes(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if 'note' in k.lower() and isinstance(v, str):
                notes.add(v)
            else:
                walk_notes(v)
    elif isinstance(o, list):
        for v in o:
            walk_notes(v)

def as_dict(o):
    return o if isinstance(o, dict) else {}

try:
    p = json.loads(PRIVATE_CFG.read_text())
    for a in as_dict(p.get('exclude')).get('accounts', []):
        add(a, 'P', strip_eq=True)
    for k in as_dict(p.get('liabilityAccountMap')):
        if k != 'note':
            add(k, 'P')
except Exception as e:
    print(f'private-config を読めない（{type(e).__name__}）')
    sys.exit(2)

paths = {l for l in git('log', '--all', '--format=', '--name-only').decode('utf-8', 'replace').splitlines()
         if l.endswith(('mf-import-config.json', 'mf-holdings.json'))}
for path in sorted(paths):
    for sha in git('log', '--all', '--format=%H', '--', path).decode().split():
        raw = git('show', f'{sha}:{path}')
        if not raw:
            continue  # その commit で削除されている
        stats['versions'] += 1
        try:
            d = json.loads(raw)
        except Exception:
            stats['parse_errors'] += 1
            continue
        if path.endswith('mf-import-config.json'):
            for a in as_dict(d.get('exclude')).get('accounts', []) or []:
                add(a, 'C', strip_eq=True)
            for k in as_dict(d.get('liabilityAccountMap')):
                if k != 'note':
                    add(k, 'C')
            for k, v in as_dict(as_dict(as_dict(d.get('fetch')).get('realEstate')).get('nameMap')).items():
                if k != 'note':
                    add(k, 'C')
                    add(v, 'C')
            walk_notes(d)
        else:
            for h in d.get('holdings', []) or []:
                add(as_dict(h).get('institution'), 'H')
            for a in as_dict(d.get('totals')).get('excludedAccounts', []) or []:
                add(a, 'H')
            for l in d.get('liabilities', []) or []:
                for k in ('institution', 'name', 'account', 'bank'):
                    add(as_dict(l).get(k), 'L')

outdir.mkdir(mode=0o700, exist_ok=True)
def write(name, lines):
    f = outdir / name
    f.write_text('\n'.join(lines) + '\n')
    f.chmod(0o600)

rows = sorted(cands, key=lambda t: (-len(t), t))
write('candidates-auto.tsv',
      [f"{t}\t{''.join(sorted(cands[t]))}\t{'SHORT' if len(t) < 4 else ''}" for t in rows])
write('notes-review.txt', sorted(notes))
print(f"versions={stats['versions']} parse_errors={stats['parse_errors']} candidates={len(rows)} "
      f"short={sum(len(t) < 4 for t in rows)} notes={len(notes)} "
      + ' '.join(f"src_{s}={sum(s in v for v in cands.values())}" for s in 'PCHL'))
```

### build_replacements.py
```python
#!/usr/bin/env python3
"""terms-final.txt → replacements.txt（--replace-text / --replace-message 用）。標準出力は件数だけ。
terms-final.txt: 1行1語。空行・# 始まりは無視。金額は先頭に AMOUNT: を付ける。
使い方: python3 build_replacements.py <private_dir>"""
import sys
from pathlib import Path

d = Path(sys.argv[1])
terms, amounts = set(), set()
for line in (d / 'terms-final.txt').read_text().splitlines():
    s = line.strip()
    if not s or s.startswith('#'):
        continue
    if s.startswith('AMOUNT:'):
        amounts.add(s[len('AMOUNT:'):].strip())
    else:
        terms.add(s)

placeholders = [f'非公開{i:02d}' for i in range(100)] + ['非公開額']
bad = [t for t in terms | amounts
       if '==>' in t or len(t) < 2 or any(t in ph for ph in placeholders)]
if bad or len(terms) > 99:
    print(f'不正な行 {len(bad)} 件（==> を含む／1文字／置換後の文字列の一部）・語数 {len(terms)}')
    sys.exit(2)

# 長い語から先に置換する（filter-repo は literal を上から順に適用する。短い語が長い語の一部を先に壊さないように）
out = [f'literal:{t}==>非公開{i:02d}' for i, t in enumerate(sorted(terms, key=lambda t: (-len(t), t)), 1)]
out += [f'literal:{a}==>非公開額' for a in sorted(amounts, key=lambda t: (-len(t), t))]
f = d / 'replacements.txt'
f.write_text('\n'.join(out) + '\n')
f.chmod(0o600)
print(f'terms={len(terms)} amounts={len(amounts)} short={sum(len(t) < 4 for t in terms)} lines={len(out)}')
```

### scan.py
```python
#!/usr/bin/env python3
"""全 ref の blob・コミット/タグのメッセージ・作者/コミッタ・パス・ref 名に、置換リストの語が何件あるか数える。
語そのものは出さない（#NN = replacements.txt の行番号＝置換後の 非公開NN）。
使い方: python3 scan.py <repo> <private_dir>   終了コード 0=残なし / 1=残あり / 2=エラー"""
import subprocess, sys
from pathlib import Path

repo, d = sys.argv[1], Path(sys.argv[2])
terms = [l[len('literal:'):].split('==>')[0].encode()
         for l in (d / 'replacements.txt').read_text().splitlines() if l.startswith('literal:')]

def git(*args, inp=None):
    return subprocess.run(['git', '-c', 'core.quotePath=false', '-C', repo, *args],
                          input=inp, capture_output=True, check=True).stdout

try:
    path_of = {}
    for line in git('rev-list', '--all', '--objects').decode('utf-8', 'replace').splitlines():
        sha, _, p = line.partition(' ')
        path_of.setdefault(sha, p)
    check = git('cat-file', '--batch-check=%(objectname) %(objecttype)',
                inp=('\n'.join(path_of) + '\n').encode()).decode().splitlines()
    blobs = [l.split()[0] for l in check if l.endswith(' blob')]
    head_blobs = {l.split()[2] for l in git('ls-tree', '-r', 'HEAD').decode('utf-8', 'replace').splitlines()}
    hits = [{'blob': 0, 'head': 0, 'msg': 0, 'path': 0, 'ref': 0, 'paths': set()} for _ in terms]

    data = git('cat-file', '--batch', inp=('\n'.join(blobs) + '\n').encode())
    pos = 0
    for _ in blobs:
        nl = data.index(b'\n', pos)
        sha, _typ, size = data[pos:nl].split()
        body = data[nl + 1: nl + 1 + int(size)]
        pos = nl + 1 + int(size) + 1
        s = sha.decode()
        for i, t in enumerate(terms):
            if t in body:
                hits[i]['blob'] += 1
                hits[i]['paths'].add(path_of.get(s, '?'))
                if s in head_blobs:
                    hits[i]['head'] += 1

    log = git('log', '--all', '--format=%an%n%ae%n%cn%n%ce%n%B%x00')
    log += git('for-each-ref', 'refs/tags', '--format=%(contents)')
    paths = set(git('log', '--all', '--format=', '--name-only').decode('utf-8', 'replace').splitlines())
    paths |= set(path_of.values())
    refs = git('for-each-ref', '--format=%(refname)')
    for i, t in enumerate(terms):
        hits[i]['msg'] = log.count(t)
        hits[i]['path'] = sum(t in p.encode() for p in paths)
        hits[i]['ref'] = refs.count(t)
except Exception as e:
    print(f'scan error: {type(e).__name__}')
    sys.exit(2)

def mask(p):
    return '<語を含むパス>' if any(t in p.encode() for t in terms) else p

total = 0
for i, h in enumerate(hits):
    n = h['blob'] + h['msg'] + h['path'] + h['ref']
    total += n
    if n:
        ex = ', '.join(sorted(mask(p) for p in h['paths'])[:5])
        print(f"#{i + 1:02d} blob={h['blob']} head={h['head']} msg={h['msg']} path={h['path']} ref={h['ref']} 例: {ex}")
doms = {e.split('@')[-1] for e in git('log', '--all', '--format=%ae%n%ce').decode('utf-8', 'replace').split()}
allow = {'gmail.com', 'users.noreply.github.com', 'github.com', 'anthropic.com'}
print(f'terms={len(terms)} blobs_scanned={len(blobs)} total_hits={total} '
      f'email_domains_outside_allowlist={len(doms - allow)}')
sys.exit(1 if total else 0)
```

### amount_keys.py
```python
#!/usr/bin/env python3
"""負債・実物資産・計算純資産の金額キーが履歴に残っていないか数える（#589 の残り確認）。値は出さない。
使い方: python3 amount_keys.py <repo>"""
import json, subprocess, sys

repo = sys.argv[1]
def git(*args):
    return subprocess.run(['git', '-c', 'core.quotePath=false', '-C', repo, *args], capture_output=True).stdout

paths = set(git('log', '--all', '--format=', '--name-only').decode('utf-8', 'replace').splitlines())
ra = [p for p in paths if p.startswith('data/real-assets/') and p.endswith('.json')]
KEYS = ('liabilitiesTotal', 'realAssetsTotal', 'netWorthComputed')
n = {'versions': 0, 'parse_errors': 0, 'liabilities': 0, **{k: 0 for k in KEYS}}
for path in (p for p in paths if p.endswith('mf-holdings.json')):
    for sha in git('log', '--all', '--format=%H', '--', path).decode().split():
        raw = git('show', f'{sha}:{path}')
        if not raw:
            continue
        try:
            d = json.loads(raw)
        except Exception:
            n['parse_errors'] += 1
            continue
        n['versions'] += 1
        if d.get('liabilities'):
            n['liabilities'] += 1
        t = d.get('totals') if isinstance(d.get('totals'), dict) else {}
        for k in KEYS:
            if t.get(k) not in (None, 0):
                n[k] += 1
print(f'real_assets_json_paths_in_history={len(ra)} ' + ' '.join(f'{k}={v}' for k, v in n.items()))
```

### compare.sh
```bash
#!/bin/bash
# 書き換え前（バックアップ）と後の HEAD ツリー・コミット数・ブランチ一覧を比べる。値は出さない。
# 使い方: bash compare.sh <before.git> <after_repo>
set -u
B=$1; A=$2
[ "$(git -C "$B" rev-parse 'main^{tree}')" = "$(git -C "$A" rev-parse 'main^{tree}')" ] \
  && echo 'HEAD tree: identical' || { echo 'HEAD tree: DIFFERENT'; git -C "$A" diff --stat "$(git -C "$B" rev-parse 'main^{tree}')" 'main^{tree}' 2>/dev/null | tail -1; }
echo "commits(main): before=$(git -C "$B" rev-list --count main) after=$(git -C "$A" rev-list --count main)"
echo "branches: before=$(git -C "$B" for-each-ref refs/heads | wc -l | tr -d ' ') after=$(git -C "$A" for-each-ref refs/heads | wc -l | tr -d ' ')"
echo "roots(main): $(git -C "$A" rev-list --max-parents=0 main | wc -l | tr -d ' ')"
```
- `HEAD tree: DIFFERENT` のときの `diff --stat` はツリーが別リポなので出ないことがある。その場合は Mac セッションが `work` 側で `git diff --name-only <旧ツリー> main` を実行し、**パス名だけ**を報告する（旧ツリーのオブジェクトが無ければ `git fetch ../backup-$D.git main:refs/tmp/old` で取り込んでから。差分の中身は表示しない）。

### push.sh（force push。既定は Toshio が実行）
```bash
#!/bin/bash
# 書き換え済みの work を GitHub に force push する。リモートが窓の前から変わっていたら中止。
set -euo pipefail
cd ~/history-rewrite
URL=https://github.com/shoulang0729/portfolio.git
git -C work remote get-url origin >/dev/null 2>&1 || git -C work remote add origin "$URL"
NOW=$(git ls-remote "$URL" 'refs/heads/*' 'refs/tags/*')
if [ "$NOW" != "$(cat state/remote-refs-before.txt)" ]; then
  echo '中止: 窓の間にリモートが変わった。6.2 の clone からやり直す'; exit 1
fi
read -r -p 'force push します。よければ yes と入力: ' ans
[ "$ans" = yes ] || { echo '中止'; exit 1; }
git -C work push --force origin 'refs/heads/*:refs/heads/*'
if [ -n "$(git -C work for-each-ref refs/tags)" ]; then
  git -C work push --force origin 'refs/tags/*:refs/tags/*'
fi
echo "remote main: $(git ls-remote "$URL" refs/heads/main | cut -f1)"
echo "local  main: $(git -C work rev-parse main)"
```

## 13. PR 分割
- **実装 PR なし**（アプリ・Worker・ワークフロー・スクリプトのリポ内ファイルは変えない。スクリプトは本書に置き、Mac mini のリポ外にコピーして使う）。
- 実施後、PM が本書の「実装ログ」と `docs/pm-queue.md` を main 直コミットで更新する（件数・日時・SHA だけ）。**新しい履歴の上で**行う。
- #687 は本作業の完了（フェーズ1 と 6.4 の検査の合格）で閉じてよい。フェーズ2（サポート・本文・再検査）は本 Issue で追う。

## 14. 受け入れ条件
- [ ] フェーズ0: `collect_candidates.py`・`amount_keys.py`（すべて 0）・リハーサルの `scan.py`（`total_hits=0`）・`compare.sh`（`HEAD tree: identical`）の結果が、件数だけで Issue に記録されている。
- [ ] Toshio の Go と（必要なら）§4.2 の許可文が、Toshio 自身のメッセージとして Issue に記録されている。
- [ ] force push 後、GitHub の全ブランチ・タグについて `scan.py` が `total_hits=0`（Mac セッションの新しいミラー clone で確認）。
- [ ] 新 main の `main^{tree}` が旧 main と一致し、旧 main の SHA は新 main の祖先でない（PM がクラウドで確認）。
- [ ] force push 後の `test.yml`・`e2e.yml` が green。GitHub Pages が表示される。
- [ ] Mac mini の作業コピーを取り直した後の最初の MF 取込が新しい履歴の上に積まれる。Mulmo の次回バッチも同様。Actions 4 本が再開されている。
- [ ] GitHub サポートへの依頼の送信（Q5＝依頼する場合）と、フォークの扱い（Q4）が記録されている。
- [ ] +1日・+7日の再検査が合格。
- [ ] 置換リスト・候補・バックアップが Mac mini から削除されている（Q6 の期限）。
- [ ] 本書・Issue・コメント・依頼文のどこにも実名・実額が無い。

## 15. 触ってはいけない範囲
- アプリ（`src/**`）・Worker（`worker/**`）・ワークフロー（`.github/workflows/**`）・`scripts/**`・`data/**` のファイル内容（HEAD ツリーは一切変えない）。
- `CLAUDE.md`・`.claude/**`（例外は §4.2 の一回限りの許可で扱う）。
- Mac mini の `~/.mf-snapshot/private-config.json`（読むだけ。書き換えない）。
- `~/GitHub/portfolio` での filter-repo 実行・push。
- Worker の Secrets・KV（今回の作業では触らない）。
