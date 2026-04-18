// ══════════════════════════════════════════════════════════════
// ai-tab.js  ―  AI 相談タブ
//
// 保有銘柄データを前提に複数の AI に同じ質問を投げ、
// 最後に Claude が各回答を統合して総括する。
//
// 依存: auth.js (aiEncrypt, aiDecrypt), positions.js (positions)
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

// AI LS キー（暗号化された API キー群を localStorage に保存）
const AI_LS_KEYS = 'hm-ai-keys-enc';

// ── 状態 ──
const aiState = {
  running:  false,
  results:  {}, // { id: { status: 'idle|loading|done|error', text: '' } }
};

// ══════════════════════════════════════════════
// API キー管理（暗号化して localStorage に保存）
// ══════════════════════════════════════════════

/** 平文の API キー群 { gpt, gemini, grok, deepseek, claude } をすべて暗号化して保存 */
async function aiSaveKeys(keys) {
  const plain = JSON.stringify(keys);
  const enc   = await aiEncrypt(plain);
  localStorage.setItem(AI_LS_KEYS, enc);
}

/** 保存された暗号化キーを復号して返す。未保存なら {} */
async function aiLoadKeys() {
  const enc = localStorage.getItem(AI_LS_KEYS);
  if (!enc) return {};
  try {
    return JSON.parse(await aiDecrypt(enc));
  } catch { return {}; }
}

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
// 各 AI への API 呼び出し
// ══════════════════════════════════════════════

async function _callOpenAI(question, systemPrompt, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: question }],
      max_tokens: 1000,
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const d = await res.json();
  return d.choices[0].message.content;
}

async function _callGemini(question, systemPrompt, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: { maxOutputTokens: 1000 },
      })
    }
  );
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '(回答なし)';
}

async function _callOpenAICompat(endpoint, model, question, systemPrompt, apiKey) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: question }],
      max_tokens: 1000,
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const d = await res.json();
  return d.choices[0].message.content;
}

async function _callClaude(question, systemPrompt, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`); }
  const d = await res.json();
  return d.content[0].text;
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
    // Markdown 風の簡易レンダリング（改行 → <br>, **bold**）
    const html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    body.innerHTML = `<div class="ai-text">${html}</div>`;
  } else if (status === 'error') {
    body.innerHTML = `<div class="ai-error">⚠ ${text}</div>`;
  } else if (status === 'no-key') {
    body.innerHTML = `<div class="ai-no-key">🔑 APIキーが未設定です<br><button class="ai-set-key-btn" onclick="openAiSettings()">設定する</button></div>`;
  }
}

// ── カードを描画（結果エリア）──
function _renderResultCards(withPortfolio) {
  const wrap = document.getElementById('ai-results-wrap');
  if (!wrap) return;

  const cards = AI_MODELS.map((m, i) => {
    const isClaude = m.id === 'claude';
    return `
      <div class="ai-card${isClaude ? ' ai-card-claude' : ''}" id="${_aiCardId(m.id)}">
        <div class="ai-card-header" style="background:${m.color}">
          <span class="ai-card-name">${m.name}</span>
          <span class="ai-card-sub">${m.sub}</span>
          ${isClaude ? '<span class="ai-card-badge">統合</span>' : ''}
        </div>
        <div class="ai-card-body" id="${_aiBodyId(m.id)}"></div>
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="ai-grid">${cards.slice(0, -1 * AI_MODELS.length + 4).replace(/\n\s+/g,' ')}</div>
    ${cards.split('</div>').slice(-2).join('</div>')}`;

  // 実際は2カラムグリッド + Claude フル幅で組む
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

  // 全カードを idle 状態に
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

  // 結果エリアを表示してカードを描画
  const resultsWrap = document.getElementById('ai-results-wrap');
  if (resultsWrap) resultsWrap.hidden = false;
  _renderResultCards(withPortfolio);

  // API キーを復号
  const keys = await aiLoadKeys().catch(() => ({}));

  // ── 最初の4モデルを並列実行 ──
  const callModel = async (m) => {
    if (!keys[m.id]) { _setCardState(m.id, 'no-key', ''); return; }
    _setCardState(m.id, 'loading', '');
    try {
      let text;
      if      (m.id === 'gpt')      text = await _callOpenAI(question, systemPrompt, keys[m.id]);
      else if (m.id === 'gemini')   text = await _callGemini(question, systemPrompt, keys[m.id]);
      else if (m.id === 'grok')     text = await _callOpenAICompat('https://api.x.ai/v1/chat/completions',     'grok-3-latest',  question, systemPrompt, keys[m.id]);
      else if (m.id === 'deepseek') text = await _callOpenAICompat('https://api.deepseek.com/chat/completions','deepseek-chat',  question, systemPrompt, keys[m.id]);
      _setCardState(m.id, 'done', text);
    } catch(e) {
      _setCardState(m.id, 'error', e.message);
    }
  };

  await Promise.allSettled(AI_MODELS.slice(0, 4).map(callModel));

  // ── Claude 統合（他の回答が揃ってから） ──
  if (!keys['claude']) {
    _setCardState('claude', 'no-key', '');
  } else {
    _setCardState('claude', 'loading', '');
    try {
      const synthesisPrompt = buildSynthesisPrompt(systemPrompt, question, aiState.results);
      const text = await _callClaude(question, synthesisPrompt, keys['claude']);
      _setCardState('claude', 'done', text);
    } catch(e) {
      _setCardState('claude', 'error', e.message);
    }
  }

  aiState.running = false;
  if (sendBtn) sendBtn.disabled = false;

  // Claude カードまでスクロール
  document.getElementById(_aiCardId('claude'))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ══════════════════════════════════════════════
// API キー設定モーダル
// ══════════════════════════════════════════════

async function openAiSettings() {
  if (document.getElementById('ai-settings-overlay')) return;
  const keys = await aiLoadKeys().catch(() => ({}));

  const fields = AI_MODELS.map(m => `
    <div class="ai-settings-row">
      <label class="ai-settings-label">
        <span class="ai-settings-name">${m.name}</span>
        <span class="ai-settings-model">${m.sub}</span>
      </label>
      <input class="ai-settings-input" type="password" id="ai-key-${m.id}"
             placeholder="sk-..." autocomplete="off"
             value="${keys[m.id] ? '●'.repeat(8) : ''}"
             data-has-key="${!!keys[m.id]}"
             onfocus="if(this.dataset.hasKey==='true'){this.value='';this.dataset.hasKey='false';}">
    </div>`).join('');

  const ov = document.createElement('div');
  ov.id = 'ai-settings-overlay';
  ov.innerHTML = `
    <div class="ai-settings-card">
      <div class="pc-header">
        <span class="pc-title">API キー設定</span>
        <button class="pc-close" onclick="closeAiSettings()">✕</button>
      </div>
      <p class="ai-settings-desc">
        キーは AES-GCM で暗号化してブラウザに保存されます。<br>
        GitHub リポジトリには一切保存されません。
      </p>
      <div class="ai-settings-fields">${fields}</div>
      <div class="ai-settings-actions">
        <button class="ai-save-btn" onclick="saveAiSettings()">保存</button>
        <button class="ai-clear-btn" onclick="clearAiKeys()">すべて削除</button>
      </div>
      <div class="ai-settings-transfer">
        <button class="ai-transfer-btn" onclick="exportAiKeys()" title="暗号化コードをコピーしてスマホに転送">📋 エクスポート</button>
        <button class="ai-transfer-btn" onclick="toggleAiImport()" title="PCでコピーしたコードを貼り付けて読み込む">📥 インポート</button>
      </div>
      <div class="ai-settings-msg" id="ai-settings-msg"></div>
    </div>`;
  document.body.appendChild(ov);

  ov._kbHandler = e => { if (e.key === 'Escape') closeAiSettings(); };
  document.addEventListener('keydown', ov._kbHandler);
  requestAnimationFrame(() => requestAnimationFrame(() => { ov.style.opacity = '1'; }));
}

function closeAiSettings() {
  const ov = document.getElementById('ai-settings-overlay');
  if (!ov) return;
  if (ov._kbHandler) document.removeEventListener('keydown', ov._kbHandler);
  ov.style.opacity = '0';
  setTimeout(() => ov.remove(), 320);
}

async function saveAiSettings() {
  const existing = await aiLoadKeys().catch(() => ({}));
  const newKeys = {};
  for (const m of AI_MODELS) {
    const inp = document.getElementById(`ai-key-${m.id}`);
    if (!inp) continue;
    const val = inp.value.trim();
    // ●●●●●●●● = 変更なし → 既存を引き継ぐ
    if (/^●+$/.test(val)) { newKeys[m.id] = existing[m.id] || ''; }
    else if (val)           { newKeys[m.id] = val; }
    else                    { newKeys[m.id] = ''; }
  }
  try {
    await aiSaveKeys(newKeys);
    const msg = document.getElementById('ai-settings-msg');
    if (msg) { msg.textContent = '✅ 保存しました'; msg.className = 'ai-settings-msg success'; }
    setTimeout(() => closeAiSettings(), 1200);
  } catch(e) {
    const msg = document.getElementById('ai-settings-msg');
    if (msg) { msg.textContent = `❌ ${e.message}`; msg.className = 'ai-settings-msg error'; }
  }
}

async function clearAiKeys() {
  localStorage.removeItem(AI_LS_KEYS);
  const msg = document.getElementById('ai-settings-msg');
  if (msg) { msg.textContent = '🗑 削除しました'; msg.className = 'ai-settings-msg success'; }
  setTimeout(() => closeAiSettings(), 1000);
}

// ── エクスポート：暗号化済みブロブをクリップボードにコピー ──
async function exportAiKeys() {
  const enc = localStorage.getItem(AI_LS_KEYS);
  const msg = document.getElementById('ai-settings-msg');
  if (!enc) {
    if (msg) { msg.textContent = '⚠ キーが未設定です'; msg.className = 'ai-settings-msg error'; }
    return;
  }
  try {
    await navigator.clipboard.writeText(enc);
    if (msg) { msg.textContent = '📋 コードをコピーしました。スマホで「インポート」に貼り付けてください。'; msg.className = 'ai-settings-msg success'; }
  } catch {
    // clipboard API が使えない場合は選択可能なテキストエリアを表示
    _showExportTextarea(enc);
  }
}

function _showExportTextarea(text) {
  const existing = document.getElementById('ai-export-area-wrap');
  if (existing) { existing.remove(); return; }
  const wrap = document.createElement('div');
  wrap.id = 'ai-export-area-wrap';
  wrap.style.cssText = 'margin-top:10px;';
  wrap.innerHTML = `<textarea id="ai-export-area" readonly
    style="width:100%;height:64px;font-size:11px;font-family:monospace;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text);padding:8px;box-sizing:border-box;resize:none;outline:none;">${text}</textarea>`;
  const actionsEl = document.querySelector('.ai-settings-actions');
  if (actionsEl) actionsEl.after(wrap);
  // 全選択
  setTimeout(() => {
    const ta = document.getElementById('ai-export-area');
    if (ta) { ta.focus(); ta.select(); }
  }, 50);
}

// ── インポート：テキストエリアを表示して貼り付けを受け付ける ──
function toggleAiImport() {
  const existing = document.getElementById('ai-import-area-wrap');
  if (existing) { existing.remove(); return; }
  const wrap = document.createElement('div');
  wrap.id = 'ai-import-area-wrap';
  wrap.style.cssText = 'margin-top:10px;';
  wrap.innerHTML = `
    <textarea id="ai-import-area" placeholder="PC でコピーしたコードを貼り付けてください..."
      style="width:100%;height:64px;font-size:11px;font-family:monospace;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text);padding:8px;box-sizing:border-box;resize:none;outline:none;"></textarea>
    <button onclick="doAiImport()" style="margin-top:6px;width:100%;padding:7px;background:var(--text);color:var(--bg);border:none;border-radius:8px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;">読み込む</button>`;
  const actionsEl = document.querySelector('.ai-settings-actions');
  if (actionsEl) actionsEl.after(wrap);
  setTimeout(() => document.getElementById('ai-import-area')?.focus(), 50);
}

async function doAiImport() {
  const val = document.getElementById('ai-import-area')?.value?.trim();
  const msg = document.getElementById('ai-settings-msg');
  if (!val) {
    if (msg) { msg.textContent = '⚠ コードを貼り付けてください'; msg.className = 'ai-settings-msg error'; }
    return;
  }
  try {
    // 復号テスト（正しい形式かチェック）
    await aiDecrypt(val);
    localStorage.setItem(AI_LS_KEYS, val);
    if (msg) { msg.textContent = '✅ 読み込みました'; msg.className = 'ai-settings-msg success'; }
    setTimeout(() => closeAiSettings(), 1200);
  } catch {
    if (msg) { msg.textContent = '❌ コードが無効です（PINが違うか、形式が不正）'; msg.className = 'ai-settings-msg error'; }
  }
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
        <button class="ai-settings-btn" onclick="openAiSettings()" title="API キー設定">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1.05 1.05M11.85 11.85l1.05 1.05M3.1 12.9l1.05-1.05M11.85 4.15l1.05-1.05" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- 質問入力 -->
      <div class="ai-input-wrap">
        <textarea class="ai-question" id="ai-question"
          placeholder="例: ポートフォリオのリスク分散は十分ですか？半導体セクターへの集中を減らすべきですか？"
          rows="3" onkeydown="if(e.ctrlKey&&e.key==='Enter')aiAskAll()"></textarea>
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

      <!-- 結果カード（初期非表示） -->
      <div id="ai-results-wrap" hidden></div>

    </div>`;
}
