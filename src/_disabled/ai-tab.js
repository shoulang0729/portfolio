// ══════════════════════════════════════════════════════════════
// ai-tab.js  ―  AI 相談タブ
//
// 質問テンプレート・市場・LLMをチェックボックスで選択して投げる。
// Claudeは常に総括担当（他モデルの回答を集約して最終回答を生成）。
// API キーは Cloudflare Worker Secrets に保管。フロントは WORKER_URL 経由。
//
// 依存: state.js (state), positions.js (positions), data.js (WORKER_URL)
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════
// AI モデル設定
// ══════════════════════════════════════════════
const AI_MODELS = [
  { id: 'gpt',      name: 'ChatGPT',  color: '#10A37F', textColor: '#fff',
    versions: ['gpt-5.4-mini', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'] },
  { id: 'gemini',   name: 'Gemini',   color: '#4285F4', textColor: '#fff',
    versions: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'] },
  { id: 'grok',     name: 'Grok',     color: '#1A1A1A', textColor: '#fff',
    versions: ['grok-4.3', 'grok-4.20-0309-reasoning', 'grok-4.20-0309-non-reasoning', 'grok-4.20-multi-agent-0309'] },
  // DeepSeek は残高不足で利用不可のため一時無効化（再開する場合は下の行のコメントを外す）
  // { id: 'deepseek', name: 'DeepSeek', color: '#1C5EFF', textColor: '#fff',
  //   versions: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'claude',   name: 'Claude',   color: '#CC785C', textColor: '#fff',
    versions: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'],
    isSynthesizer: true },
];

// ── 質問テンプレート ──
// categories: プリフェッチカテゴリ。Worker /ai/context で対応する Finnhub データを取得
const AI_QUESTION_TEMPLATES = [
  {
    id: 'news',
    label: '今日の主要ニュース',
    categories: ['news'],
    buildPrompt(markets) {
      const names = { japan: '日本', us: '米国', hk: '香港' };
      const mkt = (markets.length ? markets : ['japan', 'us']).map(m => names[m]).join('・');
      return `${mkt}市場の今日の主要ニュースと、株式市場・保有銘柄への影響を教えてください。`;
    },
  },
  {
    id: 'per',
    label: 'PER分析',
    requiresPortfolio: true,
    categories: ['fundamentals'],
    buildPrompt() {
      return '保有銘柄それぞれのPER/PBR/EPS/ROE等のファンダメンタル指標を評価し、市場平均と比較して割安・割高を判断してください。';
    },
  },
  {
    id: 'earnings',
    label: '直近の決算',
    requiresPortfolio: true,
    categories: ['earnings'],
    buildPrompt() {
      return '保有銘柄の直近4四半期の決算結果（実績EPS・予想EPS・サプライズ）を踏まえて、業績モメンタムと注目ポイントを評価してください。';
    },
  },
  {
    id: 'recommendation',
    label: 'アナリスト評価',
    requiresPortfolio: true,
    categories: ['recommendation'],
    buildPrompt() {
      return '保有銘柄の直近3ヶ月のアナリスト評価分布（強買/買/中立/売/強売）を見て、市場コンセンサスの強弱を整理してください。';
    },
  },
  {
    id: 'insider',
    label: 'インサイダー取引',
    requiresPortfolio: true,
    categories: ['insider'],
    buildPrompt() {
      return '保有銘柄の直近インサイダー取引（経営陣の売買）を確認し、注目すべき動きがあれば指摘してください。';
    },
  },
  {
    id: 'rebalance',
    label: 'リバランス提案',
    requiresPortfolio: true,
    categories: [],
    buildPrompt() {
      return '現在のポートフォリオ構成を分析し、リスク分散の観点からリバランス案を提案してください。';
    },
  },
  {
    id: 'custom',
    label: 'カスタム',
    isCustom: true,
    categories: [], // 質問文から動的推定（inferCategoriesFromQuestion）
    buildPrompt(markets, customText) { return customText; },
  },
];

// プリフェッチが「銘柄ごと」に必要なカテゴリ（macro はここに含めない）
const SYMBOL_BOUND_CATEGORIES = ['news', 'fundamentals', 'earnings', 'recommendation', 'insider'];

// カスタム質問から categories を推定（メニュー未選択時のフォールバック）
function inferCategoriesFromQuestion(q) {
  const c = [];
  if (!q) return c;
  if (/ニュース|news|報道|発表/i.test(q))                       c.push('news');
  if (/PER|PBR|EPS|ROE|割安|割高|バリュエーション|ファンダ/i.test(q)) c.push('fundamentals');
  if (/決算|earnings|業績|サプライズ/i.test(q))                 c.push('earnings');
  if (/レーティング|アナリスト|目標株価|recommendation/i.test(q)) c.push('recommendation');
  if (/インサイダー|insider/i.test(q))                          c.push('insider');
  return c;
}

// ── ルーティンプロンプト ──
const ROUTINE_JAPAN_PROMPT = `あなたは個人投資家のポートフォリオ管理を支援するアシスタントです。
以下の手順で本日の日本市場引け後レポートを作成してください。

### 保有ポートフォリオ（日本）
日本株ETF: 1615（東証銀行業ETF）/ 1629（商社・卸売ETF）/ 200A（日経半導体ETF）
個別株: 6301（小松製作所）/ 8050（セイコーグループ）/ 9983（ファーストリテイリング）
投資信託: eMAXIS Slim 全世界（オルカン, ¥112M）/ ひふみ投信 / ひふみマイクロスコープpro / ひふみクロスオーバーpro

### Step 1: 本日の日付確認
日本時間（JST）の今日の日付を確認し YYYY/MM/DD 形式で記録する。

### Step 2: 数値収集
- 日経平均・TOPIX 終値・前日比%
- USD/JPY・CNY/JPY レート
- 各保有銘柄の終値（円）・前日比%・PER（実績/予想）
- 投資信託の基準価額（直近発表値）

### Step 3: 回答フォーマット
以下の構成で回答する（Notionへの保存は不要）:
1. 本日のサマリー（3〜4行）
2. 市場データ表（日経/TOPIX/USD/CNY）
3. 保有日本株表（終値・前日比・PER）
4. 投資信託基準価額表
5. 主要ニュース・注目事項
6. 明日の注目イベント`;

const ROUTINE_US_PROMPT = `あなたは個人投資家のポートフォリオ管理を支援するアシスタントです。
以下の手順で米国市場の前夜引け後レポートを作成してください。

### 保有ポートフォリオ（米国）
大型テック: AAPL / AMZN / GOOGL / MSFT / TSLA / PLTR
ETF・コモディティ: SMH / GLDM / GDX / SLV / COPX / REMX / XLE / ILF / SHLD / SHV

### Step 1: 対象米国日付を確認（最重要）
06:00 JST実行 = 前日の米国市場が対象。JST実行日 - 1日 = 米国対象日（月曜実行時は直前金曜）。
NYタイムを検索する必要はなく、上記算術で確定すること。

### Step 2: 数値収集
- S&P500 / Nasdaq100 / ダウ / 米10年債 / 米2年債 / VIX / DXY 終値・前日比%
- 各保有銘柄の終値（USD）・前日比%・PER（実績/予想）
- GLDM・SLV・COPX・SHVはPER対象外（N/A）

### Step 3: 回答フォーマット
以下の構成で回答する（Notionへの保存は不要）:
1. 昨日（米国時間）のサマリー（3〜4行）
2. 主要指数表（S&P500/Nasdaq/ダウ/国債利回り/VIX/DXY）
3. 大型テック・半導体表（終値・前日比・PER）
4. コモディティ・資源表
5. PER評価まとめ
6. マクロ・地政学ポイント
7. ポートフォリオ注目事項
8. 本日（東京時間）の注目イベント`;

// ── 状態 ──
const AI_HISTORY_LS_KEY = 'hm-ai-history-v1';
const AI_HISTORY_MAX    = 30; // 件数上限（古いものから捨てる）

const aiState = {
  running:     false,
  results:     {}, // { id: { status: 'idle|loading|done|error', text: '' } }
  chatHistory: _loadAiHistory(), // [{ question, responses: {gpt,...,claude}, timestamp }]
};

function _loadAiHistory() {
  try {
    const raw = localStorage.getItem(AI_HISTORY_LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function _saveAiHistory() {
  try {
    // 上限を超えたら古い順にカット
    if (aiState.chatHistory.length > AI_HISTORY_MAX) {
      aiState.chatHistory = aiState.chatHistory.slice(-AI_HISTORY_MAX);
    }
    localStorage.setItem(AI_HISTORY_LS_KEY, JSON.stringify(aiState.chatHistory));
  } catch (e) { console.warn('[ai-tab] history save failed:', e); }
}

// ══════════════════════════════════════════════
// コンテキスト生成（ポートフォリオ / ウォッチリスト）
// ペルソナプロンプトは ai-system-prompt.js の ADVISOR_PERSONA_PROMPT。
// ポートフォリオ部分は _buildPortfolioBlock() で生成（後方で定義）。
// ══════════════════════════════════════════════

function buildWatchlistContext() {
  const wl = state.watchlist;
  if (!wl || wl.length === 0) return null;
  const rows = wl.map(item => {
    const price = state.watchlistPrices?.[item.ySymbol || item.symbol];
    const priceStr = price?.price ? `現在値 ${item.cur === 'USD' ? '$' : '¥'}${price.price.toLocaleString()}` : '価格未取得';
    const dayStr   = price?.dayPct != null ? ` / 当日 ${price.dayPct.toFixed(2)}%` : '';
    return `・${item.symbol}（${item.name || item.symbol}）: ${priceStr}${dayStr}`;
  }).join('\n');

  return `【ウォッチリスト（注目銘柄・未保有）】
以下は保有していないが注目している銘柄です。保有ポートフォリオとは別に参照してください:

${rows}`;
}

// システムプロンプトを組み立てる
//   1. アドバイザーペルソナ（投資壁打ちAI） ※ ai-system-prompt.js で定義
//   2. 保有ポートフォリオ（任意）
//   3. ウォッチリスト（任意）
function buildSystemPrompt(withPortfolio, withWatchlist) {
  const parts = [ADVISOR_PERSONA_PROMPT];

  if (withPortfolio) {
    parts.push(_buildPortfolioBlock());
  }

  if (withWatchlist) {
    const wlCtx = buildWatchlistContext();
    if (wlCtx) {
      parts.push(wlCtx);
      parts.push('ウォッチリスト銘柄については、保有ポートフォリオとは独立して分析し、「注目銘柄として検討すべきか」という観点でコメントしてください。');
    }
  }

  return parts.join('\n\n---\n\n');
}

// ポートフォリオ部分のみを生成（ペルソナ部分は分離）
function _buildPortfolioBlock() {
  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const rows = positions.map(p => {
    const pct = (p.value / totalValue * 100).toFixed(1);
    const pnl = p.pnlPct != null ? `（損益率 ${p.pnlPct.toFixed(1)}%）` : '';
    const cur = p.cur === 'USD' ? `$${p.price.toFixed(2)}` : `¥${Math.round(p.price).toLocaleString()}`;
    return `・${p.symbol}（${p.name}）: 評価額 ${Math.round(p.value).toLocaleString()}円 / ポートフォリオ比 ${pct}% / 現在値 ${cur}${pnl}`;
  }).join('\n');

  return `# ポートフォリオ（positions）
合計評価額: ${Math.round(totalValue / 100000000 * 100) / 100}億円

${rows}`;
}

// ══════════════════════════════════════════════
// 質問テキスト構築（チェックボックス選択から）
// ══════════════════════════════════════════════

function buildQuestionFromSelections() {
  const markets = [...document.querySelectorAll('.ai-market-check:checked')].map(el => el.value);
  const parts = [];

  for (const tpl of AI_QUESTION_TEMPLATES) {
    const cb = document.getElementById(`ai-tpl-${tpl.id}`);
    if (!cb?.checked) continue;
    if (tpl.isCustom) {
      const txt = document.getElementById('ai-custom-text')?.value.trim();
      if (txt) parts.push(txt);
    } else {
      parts.push(tpl.buildPrompt(markets));
    }
  }
  return parts.join('\n\n');
}

// ══════════════════════════════════════════════
// 各 AI への API 呼び出し（Cloudflare Worker 経由）
// ══════════════════════════════════════════════

function _buildMessages(currentQuestion) {
  const msgs = [];
  for (const item of aiState.chatHistory) {
    msgs.push({ role: 'user', content: item.question });
    const canonicalReply = item.responses?.claude || item.responses?.gpt
      || Object.values(item.responses || {}).find(v => v) || '';
    if (canonicalReply) msgs.push({ role: 'assistant', content: canonicalReply });
  }
  msgs.push({ role: 'user', content: currentQuestion });
  return msgs;
}

async function _callOpenAI(messages, systemPrompt, model = 'gpt-4o') {
  // gpt-5系・oシリーズ（o1/o3/o4）は max_tokens ではなく max_completion_tokens を要求する
  const useCompletionTokens = /^(o\d|gpt-5)/i.test(model);
  const body = {
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  };
  if (useCompletionTokens) body.max_completion_tokens = 4000;
  else                     body.max_tokens = 4000;

  const res = await fetch(`${WORKER_URL}/ai/openai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let detail = '';
    try { const j = JSON.parse(raw); detail = j?.error?.message || raw; } catch { detail = raw; }
    throw new Error(`openai HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  const d = await res.json();
  return d.choices[0].message.content;
}

async function _callGemini(messages, systemPrompt, model = 'gemini-2.0-flash') {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await fetch(`${WORKER_URL}/ai/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 4000 },
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '(回答なし)';
}

async function _callOpenAICompat(provider, model, messages, systemPrompt) {
  const res = await fetch(`${WORKER_URL}/ai/${provider}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 4000,
    }),
  });
  if (!res.ok) {
    // エラー全文を取得（OpenAI形式以外もありえるのでtextでフォールバック）
    const raw = await res.text().catch(() => '');
    let detail = '';
    try {
      const j = JSON.parse(raw);
      detail = j?.error?.message || j?.error?.code || j?.message || raw;
    } catch { detail = raw; }
    console.error(`[${provider}] HTTP ${res.status}:`, raw);
    throw new Error(`${provider} HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  const d = await res.json();
  return d.choices[0].message.content;
}

async function _callClaude(messages, systemPrompt, bodyEl, model = 'claude-sonnet-4-6') {
  const res = await fetch(`${WORKER_URL}/ai/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 4000, system: systemPrompt, messages }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const d = await res.json();
  const text = d.content?.[0]?.text ?? '(回答なし)';
  const html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
  if (bodyEl) bodyEl.innerHTML = `<div class="ai-text">${html}</div>`;
  return text;
}

// ── 統合システムプロンプト（Claude の総括用）──
function buildSynthesisPrompt(systemPrompt, question, responses, nonClaudeIds) {
  const parts = nonClaudeIds.map(id => {
    const m = AI_MODELS.find(m => m.id === id);
    const r = responses[id];
    const text = (r?.status === 'done') ? r.text : '（取得失敗）';
    return `【${m.name}の回答】\n${text}`;
  }).join('\n\n');

  const refSection = parts
    ? `━━━ 他の AI の回答（参考）━━━\n\n${parts}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n上記を踏まえた総括回答をお願いします:`
    : '以下の質問に直接回答してください:';

  return `${systemPrompt}

あなたの役割は「セカンドオピニオンの統合者」です。
他の AI モデルが同じ質問に回答しました。それらを参考情報として踏まえた上で、
あなた自身の分析・判断を加えて最終的な総括回答を行ってください。

${refSection}`;
}

// ══════════════════════════════════════════════
// UI ヘルパー
// ══════════════════════════════════════════════

// 最新ターン要素を返す（チャットログの末尾の .ai-turn）
function _currentTurn() {
  return document.querySelector('#ai-chat-log .ai-turn:last-child');
}

// 最新ターン内の指定モデルの body 要素を返す
function _currentTurnBody(modelId) {
  const turn = _currentTurn();
  return turn ? turn.querySelector(`.ai-card-body[data-model="${modelId}"]`) : null;
}

function _setCardState(modelId, status, text) {
  aiState.results[modelId] = { status, text };
  const body = _currentTurnBody(modelId);
  if (!body) return;
  if (status === 'loading') {
    body.innerHTML = '<div class="ai-loading"><span class="ai-spinner"></span>回答中...</div>';
  } else if (status === 'done') {
    const html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    body.innerHTML = `<div class="ai-text">${html}</div>`;
  } else if (status === 'error') {
    body.innerHTML = `<div class="ai-error">⚠ ${text}</div>`;
  }
}

function _getSelectedVersion(id) {
  return document.getElementById(`ai-ver-${id}`)?.value
    || AI_MODELS.find(m => m.id === id)?.versions[0];
}

// 最新ターン内に結果カード群を append する（turn-based 表示）
// 各 body は `data-model="X"` 属性で識別。ID は使わない（複数ターンで重複しないため）
function _renderResultCards(nonClaudeIds, showClaude) {
  const turn = _currentTurn();
  if (!turn) return;
  const claudeModel = AI_MODELS.find(m => m.isSynthesizer);

  const headerStyle = (m) => {
    const fg = m.textColor || '#fff';
    const subFg = m.borderColor ? m.textColor : 'rgba(255,255,255,0.75)';
    const border = m.borderColor ? `box-shadow:inset 0 0 0 1px ${m.borderColor};` : '';
    return `background:${m.color};color:${fg};--ai-sub-fg:${subFg};${border}`;
  };

  const cardHtml = (id, isClaude = false) => {
    const m = isClaude ? claudeModel : AI_MODELS.find(m => m.id === id);
    const ver = _getSelectedVersion(id);
    const cls = isClaude ? 'ai-card ai-card-claude' : 'ai-card';
    const badge = isClaude ? '<span class="ai-card-badge">統合 · 総括</span>' : '';
    return `
      <div class="${cls}">
        <div class="ai-card-header" style="${headerStyle(m)}">
          <span class="ai-card-name">${m.name}</span>
          <span class="ai-card-sub">${ver}</span>
          ${badge}
        </div>
        <div class="ai-card-body" data-model="${id}"><div class="ai-idle">準備中...</div></div>
      </div>`;
  };

  let html = '';
  if (nonClaudeIds.length > 0) {
    html += `<div class="ai-grid">${nonClaudeIds.map(id => cardHtml(id)).join('')}</div>`;
  }
  if (showClaude) {
    html += cardHtml('claude', true);
  }
  // ターンに append（既存 Q バブルの下に追加）
  turn.insertAdjacentHTML('beforeend', html);
}

// ══════════════════════════════════════════════
// プリフェッチ: 選択テンプレから categories を集約し Worker /ai/context を呼ぶ
// 失敗時は空文字を返す（LLM呼出は通常通り続行）
// ══════════════════════════════════════════════

async function _prefetchContext(question) {
  // 1. 選択テンプレから categories を集約
  const checkedTemplates = AI_QUESTION_TEMPLATES.filter(tpl =>
    document.getElementById(`ai-tpl-${tpl.id}`)?.checked
  );
  let categories = [...new Set(checkedTemplates.flatMap(t => t.categories || []))];

  // 2. カスタムが選ばれていて categories が他テンプレから取れていなければ質問文から推定
  const customChecked = document.getElementById('ai-tpl-custom')?.checked;
  if (customChecked) {
    const customText = document.getElementById('ai-custom-text')?.value || '';
    const inferred = inferCategoriesFromQuestion(customText);
    for (const c of inferred) if (!categories.includes(c)) categories.push(c);
  }

  if (categories.length === 0) return '';

  // 3. 銘柄系カテゴリがあれば保有銘柄全件を対象（macro等の銘柄非依存カテゴリは [] でOK）
  const needsSymbols = categories.some(c => SYMBOL_BOUND_CATEGORIES.includes(c));
  const targetSymbols = needsSymbols
    ? positions.map(p => p.ySymbol).filter(Boolean)
    : [];

  // 4. Worker にプリフェッチ依頼（失敗してもメイン処理は続ける）
  try {
    const res = await fetch(`${WORKER_URL}/ai/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories, targetSymbols, question }),
    });
    if (!res.ok) {
      console.warn('[ai-tab] /ai/context HTTP', res.status);
      return '';
    }
    const data = await res.json();
    console.log('[ai-tab] prefetched context:', { categories, symbols: targetSymbols.length, size: data.contextSection?.length || 0 });
    return data.contextSection || '';
  } catch (e) {
    console.warn('[ai-tab] prefetch failed:', e);
    return '';
  }
}

// ══════════════════════════════════════════════
// メイン: 全 AI に質問を投げる
// ══════════════════════════════════════════════

async function aiAskAll() {
  if (aiState.running) return;

  const question = buildQuestionFromSelections();
  if (!question.trim()) {
    alert('質問テンプレートを選択するか、カスタムテキストを入力してください');
    return;
  }

  // 選択モデルを読み取り
  const enabledIds = [...document.querySelectorAll('.ai-model-check:checked')].map(el => el.dataset.model);
  const claudeModel = AI_MODELS.find(m => m.isSynthesizer);
  const claudeEnabled = enabledIds.includes(claudeModel.id);
  const nonClaudeIds = AI_MODELS
    .filter(m => !m.isSynthesizer && enabledIds.includes(m.id))
    .map(m => m.id);

  if (nonClaudeIds.length === 0 && !claudeEnabled) {
    alert('LLMを1つ以上選択してください');
    return;
  }

  const withPortfolio = document.getElementById('ai-with-portfolio')?.checked ?? true;
  const withWatchlist = document.getElementById('ai-with-watchlist')?.checked ?? false;

  aiState.running = true;
  const sendBtn = document.getElementById('ai-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  // 新しいターンを作成（質問バブル + これから入る回答カード群を内包）
  _appendChatQuestion(question);
  _renderResultCards(nonClaudeIds, claudeEnabled);

  // ── プリフェッチ：選択テンプレ → categories → Worker /ai/context ──
  const contextSection = await _prefetchContext(question);

  const systemPrompt = buildSystemPrompt(withPortfolio, withWatchlist)
    + (contextSection ? '\n\n---\n\n' + contextSection : '');

  const messages = _buildMessages(question);

  // 非Claude モデルを並列実行
  const callModel = async (modelId) => {
    _setCardState(modelId, 'loading', '');
    try {
      const ver = _getSelectedVersion(modelId);
      let text;
      if      (modelId === 'gpt')    text = await _callOpenAI(messages, systemPrompt, ver);
      else if (modelId === 'gemini') text = await _callGemini(messages, systemPrompt, ver);
      else                           text = await _callOpenAICompat(modelId, ver, messages, systemPrompt);
      _setCardState(modelId, 'done', text);
    } catch (e) {
      _setCardState(modelId, 'error', e.message);
    }
  };

  await Promise.allSettled(nonClaudeIds.map(callModel));

  // Claude 総括（enabled の場合のみ）
  let claudeText = '';
  if (claudeEnabled) {
    _setCardState('claude', 'loading', '');
    const claudeBody = _currentTurnBody('claude');
    if (claudeBody) claudeBody.innerHTML = '<div class="ai-loading"><span class="ai-spinner"></span>統合中...</div>';
    try {
      const synthesisPrompt = buildSynthesisPrompt(systemPrompt, question, aiState.results, nonClaudeIds);
      const synMessages = [
        ...messages.slice(0, -1),
        { role: 'user', content: synthesisPrompt + '\n\n' + question },
      ];
      claudeText = await _callClaude(
        synMessages, systemPrompt,
        claudeBody || document.createElement('div'),
        _getSelectedVersion('claude'),
      );
      if (!claudeBody) _setCardState('claude', 'done', claudeText);
    } catch (e) {
      _setCardState('claude', 'error', e.message);
    }
  }

  // 会話履歴に保存
  const savedResponses = {};
  for (const id of nonClaudeIds) {
    const r = aiState.results[id];
    if (r?.status === 'done') savedResponses[id] = r.text;
  }
  if (claudeText) savedResponses['claude'] = claudeText;
  aiState.chatHistory.push({ question, responses: savedResponses, timestamp: Date.now() });
  _saveAiHistory();

  if (claudeText) _appendChatAssistant(claudeText);

  _saveToNotion(question, savedResponses);

  aiState.running = false;
  if (sendBtn) sendBtn.disabled = false;

  // 質問送信後は設定パネルを自動で畳む（回答スペースを広く取る）
  const cfg = document.getElementById('ai-section-config');
  if (cfg) cfg.open = false;

  // 最新ターンを画面内にスクロール
  _currentTurn()?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Notion 保存 ──
function _saveToNotion(question, responses) {
  const now = new Date();
  const jstStr = now.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  fetch(`${WORKER_URL}/notion/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `AI相談 ${jstStr}`, question, responses }),
  }).catch(() => {});
}

// ── ルーティン実行（カスタムテンプレートに差し込んで送信）──
function aiRunRoutine(type) {
  const q = type === 'japan' ? ROUTINE_JAPAN_PROMPT : ROUTINE_US_PROMPT;
  // 全テンプレートのチェックを外してカスタムのみにする
  AI_QUESTION_TEMPLATES.forEach(tpl => {
    const cb = document.getElementById(`ai-tpl-${tpl.id}`);
    if (cb) cb.checked = (tpl.id === 'custom');
  });
  const customArea = document.getElementById('ai-custom-area');
  if (customArea) customArea.classList.add('visible');
  const customText = document.getElementById('ai-custom-text');
  if (customText) customText.value = q;
  aiAskAll();
}

/** 新しいターンを作って質問バブルを入れる（その後の cards / Claude もこのターン内に追加される）*/
function _appendChatQuestion(text) {
  const log = document.getElementById('ai-chat-log');
  if (!log) return;
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  const turn = document.createElement('div');
  turn.className = 'ai-turn';
  turn.innerHTML = `<div class="ai-chat-q">${escaped}</div>`;
  log.appendChild(turn);
  log.scrollTop = log.scrollHeight;
}

/** Claude 総括の最終回答は専用カードとしてターン内に既に表示されるため、bubble は出さない（旧仕様の互換シム）*/
function _appendChatAssistant(text) {
  // turn-based UI 移行後は Claude カード内に表示済み。スクロール調整のみ。
  const log = document.getElementById('ai-chat-log');
  if (log) log.scrollTop = log.scrollHeight;
}

/** 会話履歴をリセット */
function aiResetChat() {
  aiState.chatHistory = [];
  aiState.results = {};
  _saveAiHistory();
  const log = document.getElementById('ai-chat-log');
  if (log) log.innerHTML = '';
}

// ══════════════════════════════════════════════
// タブ内 HTML 初期レンダリング（switchTab から呼ばれる）
// ══════════════════════════════════════════════

function renderAiTab() {
  const panel = document.getElementById('panel-ai');
  if (!panel || panel.dataset.initialized) return;
  panel.dataset.initialized = 'true';

  // 質問テンプレート HTML
  const questionsHtml = AI_QUESTION_TEMPLATES.map(tpl => {
    const isDefault = tpl.id === 'custom';
    return `
      <label class="ai-check-row">
        <input type="checkbox" id="ai-tpl-${tpl.id}" ${isDefault ? 'checked' : ''}
          ${tpl.isCustom ? `onchange="
            document.getElementById('ai-custom-area').classList.toggle('visible', this.checked);
          "` : ''}>
        <span>${tpl.label}</span>
      </label>
      ${tpl.isCustom ? `
        <div class="ai-custom-area visible" id="ai-custom-area">
          <textarea class="ai-custom-textarea" id="ai-custom-text"
            placeholder="例: ポートフォリオのリスク分散は十分ですか？半導体セクターへの集中を減らすべきですか？"
            rows="2" onkeydown="if(event.ctrlKey&&event.key==='Enter')aiAskAll()"></textarea>
        </div>` : ''}`;
  }).join('');

  // LLM モデル行 HTML
  const modelsHtml = AI_MODELS.map(m => {
    const versionsHtml = m.versions
      .map((v, i) => `<option value="${v}"${i === 0 ? ' selected' : ''}>${v}</option>`)
      .join('');
    return `
      <div class="ai-model-row">
        <input type="checkbox" class="ai-model-check" data-model="${m.id}"
          id="ai-model-${m.id}" checked>
        <label for="ai-model-${m.id}" class="ai-model-name">${m.name}</label>
        ${m.isSynthesizer ? '<span class="ai-model-badge-synth">総括</span>' : ''}
        <select class="ai-ver-select" id="ai-ver-${m.id}">${versionsHtml}</select>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="ai-panel-inner">

      <!-- ヘッダー -->
      <div class="ai-header">
        <div class="ai-header-title">AI 相談</div>
        <button class="ai-reset-btn" onclick="aiResetChat()" title="会話をリセット">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 7A6 6 0 1 1 3 11.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M1 4v3h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          リセット
        </button>
      </div>

      <!-- 設定パネル：全体を1つの <details> で開閉。中の3セクションは常時並ぶ -->
      <details class="ai-config" open id="ai-section-config">
        <summary class="ai-config-toplabel">質問設定</summary>
        <div class="ai-config-inner">

          <!-- 質問テンプレート -->
          <div class="ai-config-section">
            <div class="ai-config-title">質問</div>
            <div class="ai-config-body">${questionsHtml}</div>
          </div>

          <!-- オプション（保有銘柄・市場） -->
          <div class="ai-config-section">
            <div class="ai-config-title">オプション</div>
            <div class="ai-config-body">
              <label class="ai-check-row">
                <input type="checkbox" id="ai-with-portfolio" checked>
                <span>保有銘柄情報を含める</span>
              </label>
              <label class="ai-check-row" id="ai-with-watchlist-row">
                <input type="checkbox" id="ai-with-watchlist">
                <span>ウォッチリストを含める</span>
              </label>
              <div class="ai-config-subtitle">市場</div>
              <div class="ai-market-row">
                <label class="ai-check-row">
                  <input type="checkbox" class="ai-market-check" value="japan" checked>
                  <span>日本</span>
                </label>
                <label class="ai-check-row">
                  <input type="checkbox" class="ai-market-check" value="us" checked>
                  <span>米国</span>
                </label>
                <label class="ai-check-row">
                  <input type="checkbox" class="ai-market-check" value="hk">
                  <span>香港</span>
                </label>
              </div>
            </div>
          </div>

          <!-- LLM 選択 -->
          <div class="ai-config-section">
            <div class="ai-config-title">LLM</div>
            <div class="ai-config-body">${modelsHtml}</div>
          </div>

        </div>
      </details>

      <!-- 送信ボタン -->
      <div class="ai-send-row">
        <button class="ai-send-btn" id="ai-send-btn" onclick="aiAskAll()">
          質問する
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <!-- 会話ログ（質問・LLM回答カードを turn 単位で時系列にスタック） -->
      <div class="ai-chat-log" id="ai-chat-log"></div>

    </div>`;

  // モデルチェックボックス切り替え → バージョンセレクトのdisabled同期
  document.querySelectorAll('.ai-model-check').forEach(cb => {
    const sel = document.getElementById(`ai-ver-${cb.dataset.model}`);
    if (sel) cb.addEventListener('change', () => { sel.disabled = !cb.checked; });
  });

  // ウォッチリストが空のときはチェックボックスを無効化
  const wlRow = document.getElementById('ai-with-watchlist-row');
  const wlCb  = document.getElementById('ai-with-watchlist');
  if (wlRow && wlCb && (!state.watchlist || state.watchlist.length === 0)) {
    wlRow.classList.add('disabled');
    wlCb.disabled = true;
    wlRow.title = 'ウォッチリストに銘柄がありません';
  }

  // バージョン一覧を Worker から動的取得して上書き（失敗時はハードコード版にフォールバック）
  _refreshModelVersionsFromWorker();

  // 過去のQA履歴を再描画
  _restoreAiHistory();
}

// localStorage に保存されたQA履歴を画面に復元（各turn = 質問+回答カード群）
function _restoreAiHistory() {
  const log = document.getElementById('ai-chat-log');
  if (!log) return;
  log.innerHTML = '';
  if (!aiState.chatHistory.length) return;

  const claudeModel = AI_MODELS.find(m => m.isSynthesizer);
  const headerStyle = (m) => {
    const fg = m.textColor || '#fff';
    const subFg = m.borderColor ? m.textColor : 'rgba(255,255,255,0.75)';
    const border = m.borderColor ? `box-shadow:inset 0 0 0 1px ${m.borderColor};` : '';
    return `background:${m.color};color:${fg};--ai-sub-fg:${subFg};${border}`;
  };
  const fmtText = (t) => (t || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
  const fmtQ = (t) => (t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');

  for (const turn of aiState.chatHistory) {
    const responses = turn.responses || {};
    const nonClaudeIds = AI_MODELS.filter(m => !m.isSynthesizer && responses[m.id] !== undefined).map(m => m.id);
    const claudeText = responses['claude'];

    const cardHtml = (id, isClaude = false) => {
      const m = isClaude ? claudeModel : AI_MODELS.find(m => m.id === id);
      if (!m) return '';
      const txt = responses[id];
      const body = txt
        ? `<div class="ai-text">${fmtText(txt)}</div>`
        : '<div class="ai-error">⚠ 回答なし</div>';
      const cls = isClaude ? 'ai-card ai-card-claude' : 'ai-card';
      const badge = isClaude ? '<span class="ai-card-badge">統合 · 総括</span>' : '';
      return `
        <div class="${cls}">
          <div class="ai-card-header" style="${headerStyle(m)}">
            <span class="ai-card-name">${m.name}</span>
            ${badge}
          </div>
          <div class="ai-card-body" data-model="${id}">${body}</div>
        </div>`;
    };

    let inner = `<div class="ai-chat-q">${fmtQ(turn.question)}</div>`;
    if (nonClaudeIds.length > 0) {
      inner += `<div class="ai-grid">${nonClaudeIds.map(id => cardHtml(id)).join('')}</div>`;
    }
    if (claudeText) inner += cardHtml('claude', true);

    const turnEl = document.createElement('div');
    turnEl.className = 'ai-turn';
    turnEl.innerHTML = inner;
    log.appendChild(turnEl);
  }
  log.scrollTop = log.scrollHeight;
}

/**
 * Worker の /ai/models を fetch して各 select の <option> を最新に更新する。
 * - 各プロバイダーごとに、ハードコードされた preferred モデル（AI_MODELS[].versions[0]）が
 *   動的リストに含まれていればそれを先頭に固定し、残りを動的順で並べる。
 * - 失敗時は現状のドロップダウン（renderAiTab で描いたハードコード版）をそのまま残す。
 */
async function _refreshModelVersionsFromWorker() {
  try {
    const res = await fetch(`${WORKER_URL}/ai/models`);
    if (!res.ok) { console.warn('[ai-tab] /ai/models HTTP', res.status); return; }
    const data = await res.json();
    const map = { gpt: data.openai, gemini: data.gemini, grok: data.grok, claude: data.claude };
    for (const m of AI_MODELS) {
      const dynamic = map[m.id];
      if (!Array.isArray(dynamic) || dynamic.length === 0) continue;
      // preferred = ハードコードの versions[0]。動的リストに含まれていれば先頭に置く
      const preferred = m.versions[0];
      const ordered = dynamic.includes(preferred)
        ? [preferred, ...dynamic.filter(v => v !== preferred)]
        : dynamic;
      m.versions = ordered;
      // DOM 上の select も差し替え（現在の選択値を維持できれば維持）
      const sel = document.getElementById(`ai-ver-${m.id}`);
      if (!sel) continue;
      const prevSelected = sel.value;
      sel.innerHTML = ordered.map((v, i) =>
        `<option value="${v}"${(v === prevSelected || (i === 0 && !ordered.includes(prevSelected))) ? ' selected' : ''}>${v}</option>`
      ).join('');
    }
    console.log('[ai-tab] モデル一覧を Worker から更新');
  } catch (e) {
    console.warn('[ai-tab] モデル一覧の動的取得に失敗（ハードコード版を使用）:', e);
  }
}
