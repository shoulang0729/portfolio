// ══════════════════════════════════════════════════════════════
// ai-tab.js  ―  AI 相談タブ
//
// 保有銘柄データを前提に複数の AI に同じ質問を投げ、
// 最後に Claude が各回答を統合して総括する。
// API キーは Cloudflare Worker Secrets に保管。フロントは WORKER_URL 経由でのみ呼ぶ。
//
// 依存: state.js (state), positions.js (positions), data.js (WORKER_URL)
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════
// AI モデル設定
// ══════════════════════════════════════════════
const AI_MODELS = [
  { id: 'gpt',      name: 'ChatGPT',  sub: 'GPT-4o',              color: '#19C37D', textColor: '#fff' },
  { id: 'gemini',   name: 'Gemini',   sub: 'gemini-2.0-flash',    color: '#4285F4', textColor: '#fff' },
  { id: 'grok',     name: 'Grok',     sub: 'grok-3-latest',       color: '#1DA1F2', textColor: '#fff' },
  { id: 'deepseek', name: 'DeepSeek', sub: 'deepseek-chat',       color: '#FF6B6B', textColor: '#fff' },
  { id: 'claude',   name: 'Claude',   sub: 'claude-sonnet-4-6',   color: '#CC785C', textColor: '#fff' },
];

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
const aiState = {
  running:     false,
  results:     {}, // { id: { status: 'idle|loading|done|error', text: '' } }
  chatHistory: [], // [{ question, responses: {gpt,gemini,grok,deepseek,claude}, timestamp }]
};

// ══════════════════════════════════════════════
// ポートフォリオ コンテキスト生成
// ══════════════════════════════════════════════

function buildPortfolioContext() {
  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const rows = positions.map(p => {
    const pct = (p.value / totalValue * 100).toFixed(1);
    const pnl = p.pnlPct != null ? `（損益率 ${p.pnlPct.toFixed(1)}%）` : '';
    const cur = p.cur === 'USD' ? `$${p.price.toFixed(2)}` : `¥${Math.round(p.price).toLocaleString()}`;
    return `・${p.symbol}（${p.name}）: 評価額 ${Math.round(p.value).toLocaleString()}円 / ポートフォリオ比 ${pct}% / 現在値 ${cur}${pnl}`;
  }).join('\n');

  return `あなたは個人投資家のポートフォリオ分析を支援するアシスタントです。
以下は質問者の保有ポートフォリオです（合計評価額: ${Math.round(totalValue / 100000000 * 100) / 100}億円）:

${rows}

上記ポートフォリオを踏まえて、ユーザーの質問に簡潔かつ具体的に回答してください。
投資判断はあくまで参考情報として提供し、最終判断はユーザー自身が行うことを前提としてください。`;
}

// ══════════════════════════════════════════════
// 各 AI への API 呼び出し（Cloudflare Worker 経由）
// ══════════════════════════════════════════════

function _buildMessages(currentQuestion) {
  const msgs = [];
  for (const item of aiState.chatHistory) {
    msgs.push({ role: 'user',      content: item.question });
    const canonicalReply = item.responses?.claude || item.responses?.gpt || '';
    if (canonicalReply) msgs.push({ role: 'assistant', content: canonicalReply });
  }
  msgs.push({ role: 'user', content: currentQuestion });
  return msgs;
}

async function _callOpenAI(messages, systemPrompt) {
  const res = await fetch(`${WORKER_URL}/ai/openai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 1200,
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const d = await res.json();
  return d.choices[0].message.content;
}

async function _callGemini(messages, systemPrompt) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await fetch(`${WORKER_URL}/ai/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-2.0-flash',
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1200 },
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
      max_tokens: 1200,
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const d = await res.json();
  return d.choices[0].message.content;
}

async function _callClaude(messages, systemPrompt, bodyEl) {
  const res = await fetch(`${WORKER_URL}/ai/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      messages,
    }),
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
function buildSynthesisPrompt(systemPrompt, question, responses) {
  const parts = AI_MODELS.slice(0, 4).map(m => {
    const r = responses[m.id];
    const text = (r?.status === 'done') ? r.text : '（取得失敗）';
    return `【${m.name}の回答】\n${text}`;
  }).join('\n\n');

  return `${systemPrompt}

あなたの役割は「セカンドオピニオンの統合者」です。
他の AI モデルが同じ質問に回答しました。それらを参考情報として踏まえた上で、
あなた自身の分析・判断を加えて最終的な総括回答を行ってください。

各 AI の回答で共通している点と異なる点を簡潔に整理し、
投資家にとって最も実用的な総括を提供してください。

━━━ 他の AI の回答（参考）━━━

${parts}

━━━━━━━━━━━━━━━━━━━━━━━━

上記を踏まえた総括回答をお願いします:`;
}

// ══════════════════════════════════════════════
// UI ヘルパー
// ══════════════════════════════════════════════

function _aiCardId(modelId)    { return `ai-card-${modelId}`; }
function _aiBodyId(modelId)    { return `ai-body-${modelId}`; }

function _setCardState(modelId, status, text) {
  aiState.results[modelId] = { status, text };
  const body = document.getElementById(_aiBodyId(modelId));
  if (!body) return;
  if (status === 'loading') {
    body.innerHTML = '<div class="ai-loading"><span class="ai-spinner"></span>回答中...</div>';
  } else if (status === 'done') {
    const html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    body.innerHTML = `<div class="ai-text">${html}</div>`;
  } else if (status === 'error') {
    body.innerHTML = `<div class="ai-error">⚠ ${text}</div>`;
  }
}

function _renderResultCards() {
  const wrap = document.getElementById('ai-results-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="ai-grid">${AI_MODELS.slice(0,4).map(m => `
      <div class="ai-card" id="${_aiCardId(m.id)}">
        <div class="ai-card-header" style="background:${m.color}">
          <span class="ai-card-name">${m.name}</span>
          <span class="ai-card-sub">${m.sub}</span>
        </div>
        <div class="ai-card-body" id="${_aiBodyId(m.id)}"></div>
      </div>`).join('')}
    </div>
    <div class="ai-card ai-card-claude" id="${_aiCardId('claude')}">
      <div class="ai-card-header" style="background:${AI_MODELS[4].color}">
        <span class="ai-card-name">${AI_MODELS[4].name}</span>
        <span class="ai-card-sub">${AI_MODELS[4].sub}</span>
        <span class="ai-card-badge">統合 · 総括</span>
      </div>
      <div class="ai-card-body" id="${_aiBodyId('claude')}"></div>
    </div>`;

  AI_MODELS.forEach(m => {
    const body = document.getElementById(_aiBodyId(m.id));
    if (body) body.innerHTML = '<div class="ai-idle">準備中...</div>';
  });
}

// ══════════════════════════════════════════════
// メイン: 全 AI に質問を投げる
// ══════════════════════════════════════════════

async function aiAskAll() {
  if (aiState.running) return;

  const questionEl = document.getElementById('ai-question');
  const question   = questionEl?.value?.trim();
  if (!question) { questionEl?.focus(); return; }

  const withPortfolio = document.getElementById('ai-with-portfolio')?.checked ?? true;
  const systemPrompt  = withPortfolio ? buildPortfolioContext() : 'あなたは金融アナリストのアシスタントです。';

  aiState.running = true;
  const sendBtn = document.getElementById('ai-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  if (questionEl) questionEl.value = '';
  _appendChatQuestion(question);

  const resultsWrap = document.getElementById('ai-results-wrap');
  if (resultsWrap) resultsWrap.hidden = false;
  _renderResultCards();

  const messages = _buildMessages(question);

  // ── 最初の4モデルを並列実行 ──
  const callModel = async (m) => {
    _setCardState(m.id, 'loading', '');
    try {
      let text;
      if      (m.id === 'gpt')      text = await _callOpenAI(messages, systemPrompt);
      else if (m.id === 'gemini')   text = await _callGemini(messages, systemPrompt);
      else if (m.id === 'grok')     text = await _callOpenAICompat('grok',     'grok-3-latest', messages, systemPrompt);
      else if (m.id === 'deepseek') text = await _callOpenAICompat('deepseek', 'deepseek-chat', messages, systemPrompt);
      _setCardState(m.id, 'done', text);
    } catch(e) {
      _setCardState(m.id, 'error', e.message);
    }
  };

  await Promise.allSettled(AI_MODELS.slice(0, 4).map(callModel));

  // ── Claude 統合（他の回答が揃ってから）──
  let claudeText = '';
  _setCardState('claude', 'loading', '');
  const claudeBody = document.getElementById(_aiBodyId('claude'));
  if (claudeBody) claudeBody.innerHTML = '<div class="ai-loading"><span class="ai-spinner"></span>統合中...</div>';
  try {
    const synthesisPrompt = buildSynthesisPrompt(systemPrompt, question, aiState.results);
    const synMessages = [...messages.slice(0, -1), { role: 'user', content: synthesisPrompt + '\n\n' + question }];
    claudeText = await _callClaude(synMessages, systemPrompt, claudeBody || document.createElement('div'));
    if (!claudeBody) _setCardState('claude', 'done', claudeText);
  } catch(e) {
    _setCardState('claude', 'error', e.message);
  }

  // 会話履歴に保存
  const savedResponses = {};
  for (const m of AI_MODELS) {
    const r = aiState.results[m.id];
    if (r?.status === 'done') savedResponses[m.id] = r.text;
  }
  if (claudeText) savedResponses['claude'] = claudeText;
  aiState.chatHistory.push({ question, responses: savedResponses, timestamp: Date.now() });

  if (claudeText) _appendChatAssistant(claudeText);

  // Notion 自動保存（fire-and-forget）
  _saveToNotion(question, savedResponses);

  aiState.running = false;
  if (sendBtn) sendBtn.disabled = false;

  document.getElementById(_aiCardId('claude'))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

// ── ルーティン実行 ──
function aiRunRoutine(type) {
  const q = type === 'japan' ? ROUTINE_JAPAN_PROMPT : ROUTINE_US_PROMPT;
  const el = document.getElementById('ai-question');
  if (el) { el.value = q; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  aiAskAll();
}

/** 会話ログに質問バブルを追加 */
function _appendChatQuestion(text) {
  const log = document.getElementById('ai-chat-log');
  if (!log) return;
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  const el = document.createElement('div');
  el.className = 'ai-chat-q';
  el.innerHTML = escaped;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

/** 会話ログに Claude 総括回答バブルを追加 */
function _appendChatAssistant(text) {
  const log = document.getElementById('ai-chat-log');
  if (!log) return;
  const html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
  const el = document.createElement('div');
  el.className = 'ai-chat-a';
  el.innerHTML = `<span class="ai-chat-a-label">Claude 総括</span><div class="ai-text">${html}</div>`;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

/** 会話履歴をリセット */
function aiResetChat() {
  aiState.chatHistory = [];
  aiState.results = {};
  const log = document.getElementById('ai-chat-log');
  if (log) log.innerHTML = '';
  const resultsWrap = document.getElementById('ai-results-wrap');
  if (resultsWrap) resultsWrap.hidden = true;
}

// ══════════════════════════════════════════════
// タブ内 HTML 初期レンダリング（switchTab から呼ばれる）
// ══════════════════════════════════════════════

function renderAiTab() {
  const panel = document.getElementById('panel-ai');
  if (!panel || panel.dataset.initialized) return;
  panel.dataset.initialized = 'true';

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

      <!-- 会話ログ（質問 + Claude 総括の履歴） -->
      <div class="ai-chat-log" id="ai-chat-log"></div>

      <!-- ルーティンボタン -->
      <div class="ai-routine-btns">
        <button class="ai-routine-btn" onclick="aiRunRoutine('japan')" title="Japan Close ルーティンを実行">
          🇯🇵 Japan Close
        </button>
        <button class="ai-routine-btn" onclick="aiRunRoutine('us')" title="US Overnight ルーティンを実行">
          🇺🇸 US Overnight
        </button>
      </div>

      <!-- 質問入力 -->
      <div class="ai-input-wrap">
        <textarea class="ai-question" id="ai-question"
          placeholder="例: ポートフォリオのリスク分散は十分ですか？半導体セクターへの集中を減らすべきですか？"
          rows="3" onkeydown="if(event.ctrlKey&&event.key==='Enter')aiAskAll()"></textarea>
        <div class="ai-input-footer">
          <label class="ai-portfolio-toggle">
            <input type="checkbox" id="ai-with-portfolio" checked>
            <span>保有銘柄情報を含める</span>
          </label>
          <button class="ai-send-btn" id="ai-send-btn" onclick="aiAskAll()">
            質問する
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- 各モデル結果カード（初期非表示） -->
      <div id="ai-results-wrap" hidden></div>

    </div>`;
}
