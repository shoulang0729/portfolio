// @ts-check

// ══════════════════════════════════════════════════════════════
// glossary-data.js ―― アプリ内「用語解説」の構造化データ（#445 / 正本=Wiki 用語集）
//
// 内容の正本は docs/handoff/2026-06-21-in-app-glossary.md §5（Wiki と同期）。
// アプリは Wiki を読めないため、ここに全用語を構造化定数で持つ。
//
// 各カテゴリ: { id, title, tab: 'value'|'risk'|'both', terms: [{ term, desc }] }
//   tab='both' は Value/Risk 両タブの先頭に出す（基本概念）。
//   描画は glossary.js の glossaryHTML(tab) が tab でフィルタする。
// ══════════════════════════════════════════════════════════════

/**
 * @typedef {{ term: string, desc: string, key?: string }} GlossaryTerm
 * @typedef {{ id: string, title: string, tab: 'value'|'risk'|'both', terms: GlossaryTerm[] }} GlossaryCategory
 */

/** @type {GlossaryCategory[]} */
export const GLOSSARY = [
  {
    id: 'basics',
    title: '基本概念',
    tab: 'both',
    terms: [
      {
        term: 'クオンツ',
        desc: '数字（定量データ）だけで機械的に判断する手法。同じデータなら誰でも同じ答えになるのが利点。「定性（経営者の質・物語）」の反対。',
      },
      {
        term: '手動シード / 自動補完',
        desc: 'valuations.json に手で入れた値が手動シード。空欄は履歴から自動計算で補完。手入力があればそちらを優先（勝手に上書きしない）。',
      },
      {
        term: 'レンズ',
        desc: 'Value タブの表示切替（総合／バリュ／品質／モメンタム）。視点を切り替えて全指標を収める。',
      },
    ],
  },
  {
    id: 'valuation',
    title: '① バリュエーション（割安/割高）',
    tab: 'value',
    terms: [
      {
        term: 'PER（trail→fwd）',
        desc: '株価収益率。trail=実績／fwd=予想。右（fwd）が小さい＝来期利益が増える見込み。向きが最重要。',
        key: 'per',
      },
      { term: 'PEG', desc: 'PER ÷ 利益成長率。1未満＝割安寄り、3超＝割高。成長を加味した割高度。', key: 'peg' },
      { term: 'EV/EBITDA', desc: '企業価値 ÷ 償却前営業利益。負債込みで見る割安度。', key: 'evEbitda' },
      { term: 'FCF利回り', desc: 'フリーキャッシュフロー ÷ 時価総額。現金を生む力に対する割安度。', key: 'fcfYield' },
      {
        term: '%タイル',
        desc: 'その銘柄自身の過去PERバンドの中で今が何%の位置か。低い＝過去比で割安。',
        key: 'percentile',
      },
      {
        term: 'verdict（判定）',
        desc: '🟢本物の割安／🟡見せかけの割安(フェア)／🔴本物の割高／⚪見せかけの割高(売るな)／⛔value trap、を決定論で自動分類。割安/割高の「位置」と利益の「向き」を合成した結論。',
      },
      {
        term: 'value trap（罠）',
        desc: '割安に見えるが構造的に稼げない銘柄。Quality 指標で炙り出す。',
      },
      {
        term: 'リバースDCF / 織り込み成長率',
        desc: '今の株価が「年何%のFCF成長」を前提にしているかを逆算。(WACC − FCF利回り) ÷ (1 + FCF利回り)。妥当域より高い＝市場が期待を盛りすぎ（期待過多）のサイン。個別株のみ・参考値。',
        key: 'impliedGrowth',
      },
      {
        term: '目標株価乖離（targetGap）',
        desc: 'アナリスト平均目標株価と現値の差（%）。プラス大＝上値余地が見込まれている。アナリスト数が少ない銘柄は信頼度低め。',
        key: 'targetGap',
      },
      {
        term: '株主還元',
        desc: '配当＋自社株買いで毎年株主に戻す現金の利回り。高いほど手厚い（3%超で厚い）。',
        key: 'shareholderYield',
      },
      {
        term: 'ETF proxy',
        desc: 'ETFは単一PERが無いので発行体公表のファンド実績PERで代用＝粗い近似で「proxy」バッジ。シクリカル/コモディティETF（COPX/REMX/XLE）はPERが逆張りになるため判定対象外。',
      },
    ],
  },
  {
    id: 'quality',
    title: '② Quality（品質・稼ぐ力／罠の排除）',
    tab: 'value',
    terms: [
      {
        term: 'ROIC',
        desc: '投下資本利益率。ROIC > WACC なら価値創造、下回ると稼ぐほど価値破壊。',
        key: 'roic',
      },
      { term: 'WACC', desc: '加重平均資本コスト。ROIC が超えるべきハードル。' },
      {
        term: 'グロス収益性（Novy-Marx）',
        desc: '粗利 ÷ 総資産。質の高い割安株を見抜く学術指標。',
        key: 'grossProfitability',
      },
      {
        term: 'FCF変換率',
        desc: '純利益がどれだけ実際の現金（FCF）になるか。低い＝利益が見かけ倒しの疑い。',
        key: 'fcfConversion',
      },
      {
        term: 'F-Score（0〜9・Piotroski）',
        desc: '収益性・財務・効率の9項目を各1点。7〜9＝健全、0〜2＝危険（罠濃厚）。',
        key: 'fScore',
      },
      {
        term: 'Altman Z',
        desc: '倒産確率の合成指標。3超＝安全圏／1.8未満＝危険ゾーン。',
        key: 'altmanZ',
      },
      { term: 'インタレストカバレッジ', desc: '営業利益 ÷ 支払利息。借金の利払い余力。' },
      { term: 'Qスコア（0〜9）', desc: '上記を束ねた品質スコア。', key: 'qScore' },
    ],
  },
  {
    id: 'momentum',
    title: '③ モメンタム（勢い）',
    tab: 'value',
    terms: [
      { term: 'priceMom1Y（1Y騰落率）', desc: '直近1年の単純リターン（%）。', key: 'priceMom1Y' },
      {
        term: 'pos52w（52週位置）',
        desc: '52週レンジ内の現在位置（0%=安値・100%=高値）。',
        key: 'pos52w',
      },
      {
        term: 'epsRev90d（業績改定）',
        desc: '直近90日でアナリストEPS予想が上方/下方修正された度合い。プラス＝期待が上向き。',
        key: 'epsRev90d',
      },
      {
        term: 'rsVsSector（対市場 相対強さ）',
        desc: '世界株ACWIと比べた値動きの強さ。地合いでなく個別の強さを見る。',
        key: 'rsVsSector',
      },
    ],
  },
  {
    id: 'discipline',
    title: '⑤ 規律（売りルール・的中率）',
    tab: 'value',
    terms: [
      {
        term: '売りトリガー3種',
        desc: 'テーゼ崩壊売り／目標到達売り／バンド・リバランス売り。事前に決めて売り遅れを防ぐ。',
        key: 'sellTriggers',
      },
      {
        term: '的中率（hit-rate）',
        desc: '過去の判断が当たったかの学習ループ。発議とverdictを別建てで採点。',
        key: 'hitRate',
      },
      {
        term: '過大ポジ',
        desc: '今のサイズが適正比率を超えている保有の本数。減らす候補の数。',
        key: 'overweightCount',
      },
      {
        term: '割安候補',
        desc: '判定エンジンが「割安（cheap）」と見ている銘柄の本数。買い増し検討の母数。',
        key: 'cheapCount',
      },
      {
        term: '発議の的中',
        desc: '売り発議→その後 対ACWIでアンダーパフォームなら hit／買い→アウトパフォームなら hit。判定地平≈1ヶ月。',
      },
      {
        term: 'verdictの的中',
        desc: 'cheap→対ACWIアウトパフォーム／rich→アンダーで hit。判定地平≈6ヶ月。',
      },
      {
        term: '対ACWI相対',
        desc: '地合いノイズを除くため、世界株ACWIとの差で採点。',
      },
      {
        term: '自動提案',
        desc: '判定地平が過ぎたものを履歴から機械が hit/miss 提案。手動判定があればそちら優先。',
      },
    ],
  },
  {
    id: 'card',
    title: '⑥ カードの見方（※確信度と判定確度は別概念）',
    tab: 'value',
    terms: [
      {
        term: '確信度（conviction）',
        desc: '自分の主観的な自信（打診／標準／高確信）。適正サイズ(%)を決める入力。',
      },
      {
        term: '判定確度（confidence）',
        desc: 'エンジンの判定がどれだけ信頼できるか（データ充足＋シグナル一致＋境界余裕）。●●○ 高/中/低。確信度とは別物。',
      },
      {
        term: 'アクションバナー',
        desc: 'カード上部（▼トリム／▲積増／◦監視／▪維持）。色=売り赤/買い緑/監視アンバー/維持灰。',
      },
      {
        term: '発散型サイズバー',
        desc: '左端0%・右端=適正×2・適正が常に中央。適正の2倍超は満タン＋「× N」。',
      },
      { term: '罠サブ種別', desc: '割安の罠（破線）／一過性益（塗り）。' },
    ],
  },
  {
    id: 'risk',
    title: '④ Risk（PF全体のリスク）',
    tab: 'risk',
    terms: [
      {
        term: 'ボラ（ボラティリティ）',
        desc: '値動きの激しさ。日次リターン標準偏差 × √252 で年率化。',
      },
      {
        term: '相関（ピアソン）',
        desc: '2銘柄が一緒に動く度合い（-1〜+1）。高相関ばかり＝分散できず一緒に落ちる。',
      },
      {
        term: '最悪日 / 最悪1ヶ月',
        desc: '過去で最も下げた1日／1ヶ月の下落率（ストレス感覚）。',
      },
      { term: '最大DD（ドローダウン）', desc: '高値から谷までの最大下落率。一番苦しい局面の沈み。' },
      {
        term: 'PFβ',
        desc: '各銘柄がPF全体に対しどれだけ敏感に動くか。β大＝PFの揺れの増幅役。',
      },
      {
        term: 'リスク寄与（vol×|β|）',
        desc: 'ボラ × ベータ絶対値。PFリスクへの寄与が大きい銘柄ランキング。',
      },
      {
        term: 'ストレス replay（名前付きイベント）',
        desc: '「今のPFが当時を再体験したら」何%下落したかを、実保有×実履歴を過去イベントの日付レンジで切って算出（実損益ではなく what-if）。例＝2025関税ショック／2025-01 DeepSeek／2024-08 円キャリー巻き戻し／2023 SVB／2022弱気相場。',
      },
      {
        term: 'カバレッジ%',
        desc: 'そのイベント期間に価格データがある保有のウェイト割合。後発IPO（200A.T等）は除外・再正規化し%を明示。',
      },
    ],
  },
  {
    id: 'liquidity',
    title: '流動性（出口日数）',
    tab: 'risk',
    terms: [
      {
        term: '流動性',
        desc: 'その銘柄がどれだけ活発に売買されているか。出来高が多い＝すぐ売れる。',
      },
      { term: 'ADV', desc: '1日平均出来高。既定は直近20営業日平均。' },
      {
        term: '参加率',
        desc: '1日に市場出来高の何%まで売るかの上限前提。既定10%/日（自分の売りで株価を崩さない目安）。',
      },
      {
        term: '出口日数',
        desc: '保有株数 ÷ (ADV × 参加率)。売り切るのに何営業日かかるか。株数ベースで為替非依存。',
      },
      {
        term: '警告',
        desc: '出口5営業日超（=1週間で逃げられない）を赤表示。',
      },
    ],
  },
  {
    id: 'region',
    title: '⑦ 地域エクスポージャ（ルックスルー）',
    tab: 'risk',
    terms: [
      {
        term: '真の地域%（ルックスルー）',
        desc: 'オルカン/ひふみ等の全世界ファンドを地域構成比で分解し、PF全体の本当の地域配分を出す。例＝日本は ACWI内5% ＋ 1306 ＋ ひふみ ＋ 日本個別 が積み上がる。',
      },
      {
        term: 'ホームバイアス',
        desc: '自国（日本）に偏る傾向。真の日本% − ベンチ(ACWI 5%) で何pt 上乗せかを表示。意図的な傾けかを一目で確認。',
      },
      {
        term: '地域タグ / 地域枠',
        desc: '各保有に地域タグ（japan/北米/欧州/新興 等）を付けルックスルーと合算。VGK/ハンセン等は未保有なら枠だけ用意（将来買い増し時に自動で乗る）。',
      },
    ],
  },
];
