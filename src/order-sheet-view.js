// @ts-check

// ══════════════════════════════════════════════════════════════
// order-sheet-view.js  ―  Order タブ（注文表）の描画用の純関数
//
// 設計: docs/handoff/2026-10-03-order-sheet.md §7（表示場所は §12 冒頭の
// 2026-10-04 Toshio 決定で新タブ「Order」）。
// - 入力は Worker `GET /order-sheet` の応答（§4.2）。計算はしない（表示の整形だけ）。
// - DOM・fetch・state に触らない（vitest で合成値を使って検証する）。
// - 外部値（銘柄・note・警告文）は必ず escapeHTML を通す。
// - 金額（$）は masked のとき maskAmount で伏字にする。指値・株数・% は常時表示（§7.2）。
// - 公開リポ: このファイルに実値を書かない。
// ══════════════════════════════════════════════════════════════

import { escapeHTML, maskAmount } from './fmt.js';

/** @param {unknown} v */
function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * 指値の表示（$20 以上は整数、未満は小数 2 桁。null は成行）
 * @param {number|null|undefined} x
 */
export function fmtLimit(x) {
  if (!isNum(x)) return '成行';
  return x >= 20 ? `$${Math.round(x)}` : `$${x.toFixed(2)}`;
}

/**
 * 金額の表示（整数ドル・3 桁区切り）。masked なら数字を伏字にする。
 * @param {number|null|undefined} x
 * @param {boolean} masked
 */
export function fmtUsd(x, masked) {
  if (!isNum(x)) return '—';
  const s = `${x < 0 ? '−' : ''}$${Math.abs(Math.round(x)).toLocaleString('en-US')}`;
  return masked ? maskAmount(s) : s;
}

/**
 * % の表示（小数 1 桁）。比率は常時表示。
 * @param {number|null|undefined} x
 */
export function fmtPct(x) {
  return isNum(x) ? `${x.toFixed(1)}%` : '—';
}

/**
 * 株数の表示（整数は 3 桁区切り・小数はそのまま）
 * @param {number|null|undefined} q
 */
export function fmtQty(q) {
  if (!isNum(q)) return '?';
  return Number.isInteger(q) ? q.toLocaleString('en-US') : String(q);
}

/**
 * 文中の金額（「$1,234」の形）だけを伏字にする（警告文・注記用）。
 * - 金額は Worker の fmtUsd と同じ整数ドル（3 桁区切り）。小数つき（$9.50）は指値の形なので残す。
 * - 「指値 $368」や「$368×10」のように指値と分かるものは残す（指値は常時表示・§7.2）。
 * - 末尾の「.」「,」は文の区切りとして伏字の対象に含めない。
 * @param {string} text
 * @param {boolean} masked
 */
export function maskDollarText(text, masked) {
  const s = String(text ?? '');
  if (!masked) return s;
  return s.replace(/(指値\s*)?\$\d+(?:,\d{3})*(\.\d+)?/g, (m, limitWord, decimals, offset) => {
    if (limitWord || decimals || s.charAt(offset + m.length) === '×') return m;
    return maskAmount(m);
  });
}

/** 状態ピルのラベル */
export const STATUS_LABEL = {
  toPlace: '要発注',
  placed: '発注中',
  partial: '一部約定',
  waiting: '待機',
  filled: '約定済',
  cancelled: '取消',
};

/** 停止理由のラベル（§6.4） */
export const SUPPRESSED_LABEL = {
  targetReached: '停止（目標到達）',
  themeCapReached: '停止（テーマ上限）',
  cashFloor: '停止（現金ガード）',
};

/** 目標到達で HOLD になった発注中の買い段に付ける注記（§12 冒頭・2026-10-04 Toshio 決定） */
export const HOLD_CANCEL_NOTE = '目標到達・取消を検討';

/**
 * 表示用の「今出す注文」行を組み立てる。
 * Worker の orders に加え、目標到達（hold=targetReached）で停止した**発注中**（placed/partial）の
 * 買い段を、行を残して「目標到達・取消を検討」の注記つきで足す（証券会社に注文が残っているため）。
 * 資金計算には入れない（Worker の計算どおり）。
 * @param {any} sheet GET /order-sheet の応答
 * @returns {any[]}
 */
export function buildOrderRows(sheet) {
  const orders = Array.isArray(sheet?.orders) ? sheet.orders : [];
  const rows = orders.map((o) => ({ ...o, kind: o?.role === 'funding' ? 'funding' : 'order' }));
  const ladders = Array.isArray(sheet?.ladders) ? sheet.ladders : [];
  const holdRows = [];
  for (const l of ladders) {
    if (!l || l.hold !== 'targetReached') continue;
    const stages = Array.isArray(l.stages) ? l.stages : [];
    const st = stages.find((s) => s && s.state === 'working');
    if (!st || st.side !== 'buy') continue;
    if (st.display !== 'placed' && st.display !== 'partial') continue;
    // 同じ段が既に orders にあれば重ねない
    if (rows.some((r) => r.symbol === l.symbol && r.stageId === st.id)) continue;
    holdRows.push({
      kind: 'holdCancel',
      symbol: l.symbol,
      side: 'buy',
      tier: l.tier,
      stageId: st.id,
      status: st.display,
      limit: st.limit,
      qty: st.qty,
      filledQty: isNum(st.filledQty) ? st.filledQty : 0,
      amountUsd: st.amountUsd,
      curUsd: l.curUsd,
      curPct: l.curPct,
      afterUsd: null,
      afterPct: null,
      targetUsd: l.targetUsd,
      targetPct: l.targetPct,
      next: null,
      flags: ['holdCancel'],
      notes: [HOLD_CANCEL_NOTE],
    });
  }
  // 資金繰り（JPST 売）は末尾のまま、HOLD 行はその前に置く
  const fundingRows = rows.filter((r) => r.kind === 'funding');
  const orderRows = rows.filter((r) => r.kind !== 'funding');
  return [...orderRows, ...holdRows, ...fundingRows];
}

/**
 * 件数の要約（ヘッダ用）
 * @param {any[]} rows buildOrderRows の戻り値
 */
export function summarizeRows(rows) {
  let toPlace = 0;
  let placed = 0;
  let holdCancel = 0;
  for (const r of rows) {
    if (r.kind === 'holdCancel') holdCancel++;
    else if (r.kind === 'order' && r.status === 'toPlace') toPlace++;
    else if (r.kind === 'order') placed++;
  }
  return { toPlace, placed, holdCancel };
}

/**
 * 申告ボタン 1 個
 * @param {string} action data-action 名
 * @param {string} symbol
 * @param {string} stageId
 * @param {string} label
 * @param {boolean} [primary]
 */
function btn(action, symbol, stageId, label, primary = false) {
  const arg = `${symbol}:${stageId}`;
  return `<button type="button" class="os-btn${primary ? ' os-btn--primary' : ''}" data-action="${action}" data-arg="${escapeHTML(arg)}">${escapeHTML(label)}</button>`;
}

/**
 * 行の状態ピル
 * @param {any} r
 */
function statusPill(r) {
  if (r.kind === 'funding') return '<span class="os-pill os-pill--funding">資金繰り</span>';
  if (r.kind === 'holdCancel') return `<span class="os-pill os-pill--warn">${escapeHTML(HOLD_CANCEL_NOTE)}</span>`;
  const label = STATUS_LABEL[r.status] || String(r.status ?? '');
  const extra = r.status === 'partial' ? ` ${fmtQty(r.filledQty)}/${fmtQty(r.qty)}` : '';
  const cls = r.status === 'toPlace' ? 'os-pill--place' : 'os-pill--working';
  return `<span class="os-pill ${cls}">${escapeHTML(label + extra)}</span>`;
}

/**
 * 行のボタン群（§7.3）
 * @param {any} r
 */
function rowButtons(r) {
  if (r.kind === 'funding') return '';
  const sym = String(r.symbol ?? '');
  const sid = String(r.stageId ?? '');
  if (r.status === 'toPlace') {
    return btn('orderPlaced', sym, sid, '発注した', true) + btn('orderFilled', sym, sid, '約定した');
  }
  return btn('orderFilled', sym, sid, '約定した', true) + btn('orderUnplace', sym, sid, '発注を取り消した');
}

/**
 * 今出す注文の表（指値×株数）
 * @param {any[]} rows
 * @param {boolean} masked
 */
export function renderOrdersTable(rows, masked) {
  if (!rows.length) return '<div class="os-empty">今出す注文はありません</div>';
  const head =
    '<tr><th class="os-sym">銘柄</th><th>売買</th><th class="os-num">指値</th><th class="os-num">株数</th>' +
    '<th class="os-num">金額</th><th class="os-num">約定後</th><th class="os-num">目標</th><th>状態</th></tr>';
  const body = rows
    .map((r) => {
      const side = r.side === 'sell' ? '売' : '買';
      const sideCls = r.side === 'sell' ? 'os-side--sell' : 'os-side--buy';
      const isFunding = r.kind === 'funding';
      const after =
        isFunding || r.afterUsd == null
          ? '—'
          : `${fmtUsd(r.afterUsd, masked)} <span class="os-sub">${fmtPct(r.afterPct)}</span>`;
      const target =
        r.targetUsd == null ? '—' : `${fmtUsd(r.targetUsd, masked)} <span class="os-sub">${fmtPct(r.targetPct)}</span>`;
      const itm = r.inTheMoney === true && !isFunding && r.limit != null ? ' <span class="os-tag">指値到達</span>' : '';
      const main =
        `<tr class="os-row${r.kind === 'holdCancel' ? ' os-row--hold' : ''}">` +
        `<td class="os-sym">${escapeHTML(String(r.symbol ?? ''))}</td>` +
        `<td class="${sideCls}">${side}</td>` +
        `<td class="os-num">${escapeHTML(fmtLimit(r.limit))}${itm}</td>` +
        `<td class="os-num">${escapeHTML(fmtQty(r.qty))}</td>` +
        `<td class="os-num">${escapeHTML(fmtUsd(r.amountUsd, masked))}</td>` +
        `<td class="os-num">${after}</td>` +
        `<td class="os-num">${target}</td>` +
        `<td>${statusPill(r)}</td></tr>`;
      // 2 行目: 次の段の条件・注記・ボタン（横スクロールしても左端に固定して見せる）
      const parts = [];
      if (isFunding) {
        parts.push(
          `<span class="os-next">${escapeHTML(maskDollarText(r.text || '米ドル買いの不足分を充当', masked))}</span>`
        );
      } else if (r.next && r.next.text) {
        parts.push(`<span class="os-next">└ ${escapeHTML(String(r.next.text))}</span>`);
      }
      const notes = Array.isArray(r.notes) ? r.notes.filter((n) => n && n !== HOLD_CANCEL_NOTE) : [];
      for (const n of notes) parts.push(`<span class="os-flag">${escapeHTML(maskDollarText(n, masked))}</span>`);
      if (r.kind === 'holdCancel')
        parts.push(`<span class="os-flag os-flag--warn">${escapeHTML(HOLD_CANCEL_NOTE)}</span>`);
      const buttons = rowButtons(r);
      const actions = buttons ? `<div class="os-actions">${buttons}</div>` : '';
      const subCls = `os-subrow${r.kind === 'holdCancel' ? ' os-row--hold' : ''}`;
      const sub =
        `<tr class="${subCls}"><td colspan="8"><div class="os-subrow-inner">` +
        `<div class="os-subrow-text">${parts.join('')}</div>${actions}</div></td></tr>`;
      return main + sub;
    })
    .join('');
  return `<div class="os-scroll"><table class="os-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/**
 * 現金ガード・AI/テック合計のピル
 * @param {any} sheet
 */
export function renderGuardPills(sheet) {
  const cash = sheet?.cash || {};
  const ai = sheet?.aiTech || {};
  const cashCls = cash.guardActive ? 'os-gpill os-gpill--warn' : 'os-gpill';
  const cashText = `現金 ${fmtPct(cash.pct)} / 下限 ${fmtPct(cash.floorPct)}`;
  const guardNote = cash.guardActive
    ? '<div class="os-warn">現金が下限を割っているため、各銘柄の最深段を停止しています</div>'
    : '';
  const aiCls = ai.over ? 'os-gpill os-gpill--warn' : 'os-gpill';
  const aiText = `AI/テック ${fmtPct(ai.now)}→${fmtPct(ai.afterWorking)}→${fmtPct(ai.final)} / 上限 ${fmtPct(ai.capPct)}`;
  return (
    `<div class="os-gpills"><span class="${cashCls}">${escapeHTML(cashText)}</span>` +
    `<span class="${aiCls}">${escapeHTML(aiText)}</span></div>${guardNote}`
  );
}

/**
 * 資金繰り（USD）
 * @param {any} sheet
 * @param {boolean} masked
 */
export function renderFunding(sheet, masked) {
  const u = sheet?.funding?.usd || {};
  const a = sheet?.funding?.allStages || {};
  const sym = escapeHTML(String(u.sweepSymbol || 'JPST'));
  let sweep;
  if (u.sweepQty == null) sweep = `<span class="os-warn-text">${sym} の売却株数を計算できません</span>`;
  else if (u.sweepQty > 0)
    sweep = `${sym} 売 <b>${escapeHTML(fmtQty(u.sweepQty))} 株</b>（${escapeHTML(fmtUsd(u.sweepUsd, masked))}）`;
  else sweep = `${sym} の売却は不要`;
  const capped = u.sweepCapped
    ? `<div class="os-warn">${sym} の保有株数まで売っても ${escapeHTML(fmtUsd(u.sweepShortUsd, masked))} 不足</div>`
    : '';
  const short = !isNum(a.shortfallUsd)
    ? '<div class="os-warn">全段の合計に対する資金の過不足を計算できません</div>'
    : a.shortfallUsd > 0
      ? `<div class="os-warn">全段の合計に対し資金が ${escapeHTML(fmtUsd(a.shortfallUsd, masked))} 不足</div>`
      : '<div class="os-ok">全段の合計に対し資金は足りています</div>';
  const kv = (k, v) => `<div class="os-kv"><span>${k}</span><span>${v}</span></div>`;
  return [
    '<div class="os-card"><div class="os-card-title">資金繰り（米ドル）</div>',
    kv('今の注文の買い', escapeHTML(fmtUsd(u.buyWorking, masked))),
    kv('今の注文の売り', escapeHTML(fmtUsd(u.sellWorking, masked))),
    kv('米ドル預り金', escapeHTML(fmtUsd(u.usdCash, masked))),
    kv('不足分の充当', sweep),
    capped,
    kv('全段の買い合計', escapeHTML(fmtUsd(a.buyTotal, masked))),
    kv('全段の売り＋充当可能', escapeHTML(fmtUsd(a.available, masked))),
    short,
    '</div>',
  ].join('');
}

/**
 * 3 時点の % セル
 * @param {number|null|undefined} v
 * @param {boolean} over
 */
function pctCell(v, over) {
  return `<td class="os-num${over ? ' os-over' : ''}">${fmtPct(v)}</td>`;
}

/**
 * AI/テック合計とテーマ使用率（3 時点）
 * @param {any} sheet
 */
export function renderAiTech(sheet) {
  const ai = sheet?.aiTech;
  if (!ai) return '';
  const cap = ai.capPct;
  const overOf = (v, c) => isNum(v) && isNum(c) && v > c;
  const rows = [
    `<tr><td>AI/テック合計</td>${pctCell(ai.now, overOf(ai.now, cap))}${pctCell(ai.afterWorking, overOf(ai.afterWorking, cap))}${pctCell(ai.final, overOf(ai.final, cap))}<td class="os-num">${fmtPct(cap)}</td></tr>`,
  ];
  for (const t of Array.isArray(ai.themes) ? ai.themes : []) {
    rows.push(
      `<tr><td class="os-indent">${escapeHTML(String(t?.theme ?? ''))}</td>${pctCell(t?.now, overOf(t?.now, t?.cap))}${pctCell(t?.afterWorking, overOf(t?.afterWorking, t?.cap))}${pctCell(t?.final, overOf(t?.final, t?.cap))}<td class="os-num">${fmtPct(t?.cap)}</td></tr>`
    );
  }
  return (
    '<div class="os-card"><div class="os-card-title">AI/テック（総資産比）</div><div class="os-scroll"><table class="os-table os-table--mini">' +
    '<thead><tr><th></th><th class="os-num">現在</th><th class="os-num">今の注文後</th><th class="os-num">全段約定後</th><th class="os-num">上限</th></tr></thead>' +
    `<tbody>${rows.join('')}</tbody></table></div></div>`
  );
}

/**
 * ストレス（総資産比の落ち込み・3 時点）
 * @param {any} sheet
 */
export function renderStress(sheet) {
  const s = sheet?.stress;
  if (!s) return '';
  const rows = (Array.isArray(s.scenarios) ? s.scenarios : []).map(
    (sc) =>
      `<tr><td>${escapeHTML(String(sc?.label ?? sc?.id ?? ''))}</td>${pctCell(sc?.now, !!sc?.overNow)}${pctCell(sc?.afterWorking, !!sc?.overAfterWorking)}${pctCell(sc?.final, !!sc?.overFinal)}</tr>`
  );
  const eq = s.equityPct || {};
  rows.push(
    `<tr><td>株の比率</td>${pctCell(eq.now, false)}${pctCell(eq.afterWorking, false)}${pctCell(eq.final, false)}</tr>`
  );
  return (
    `<div class="os-card"><div class="os-card-title">ストレス（許容 ${fmtPct(s.tolerancePct)}）</div><div class="os-scroll"><table class="os-table os-table--mini">` +
    '<thead><tr><th></th><th class="os-num">現在</th><th class="os-num">今の注文後</th><th class="os-num">全段約定後</th></tr></thead>' +
    `<tbody>${rows.join('')}</tbody></table></div></div>`
  );
}

/**
 * はしご全体（銘柄ごと・折りたたみ）
 * @param {any} sheet
 * @param {boolean} masked
 */
export function renderLadders(sheet, masked) {
  const ladders = Array.isArray(sheet?.ladders) ? sheet.ladders : [];
  if (!ladders.length) return '';
  const items = ladders
    .map((l) => {
      const sym = String(l?.symbol ?? '');
      const target = l?.targetUsd == null ? '—' : `${fmtUsd(l.targetUsd, masked)}(${fmtPct(l.targetPct)})`;
      const base = isNum(l?.basePrice) ? `${fmtLimit(l.basePrice)}${l.baseEvent ? ` (${l.baseEvent})` : ''}` : '—';
      const hold =
        l?.hold === 'targetReached'
          ? '<span class="os-pill os-pill--hold">目標到達・HOLD</span>'
          : l?.hold === 'themeCapReached'
            ? '<span class="os-pill os-pill--hold">テーマ上限・HOLD</span>'
            : '';
      const head =
        `<div class="os-lad-head"><b>${escapeHTML(sym)}</b> <span class="os-sub">${escapeHTML(String(l?.tier ?? ''))}</span> ${hold}</div>` +
        `<div class="os-lad-meta">目標 ${escapeHTML(target)} ・ 現在 ${escapeHTML(fmtUsd(l?.curUsd, masked))}(${fmtPct(l?.curPct)}) ・ 基準 ${escapeHTML(base)}</div>`;
      const note = l?.note ? `<div class="os-lad-meta">${escapeHTML(String(l.note))}</div>` : '';
      const notes = (Array.isArray(l?.notes) ? l.notes : [])
        .filter((n) => n && n !== '目標到達・HOLD')
        .map((n) => `<div class="os-flag">${escapeHTML(maskDollarText(n, masked))}</div>`)
        .join('');
      const stages = (Array.isArray(l?.stages) ? l.stages : [])
        .map((st) => {
          const side = st?.side === 'sell' ? '売 ' : '';
          const label = st?.suppressed
            ? SUPPRESSED_LABEL[st.suppressed] || '停止'
            : STATUS_LABEL[st?.display] || String(st?.display ?? '');
          const muted =
            st?.suppressed || st?.display === 'filled' || st?.display === 'cancelled' || st?.display === 'waiting';
          const auto = st?.autoDetected ? ' <span class="os-tag">自動検知</span>' : '';
          let actions = '';
          if (st?.state === 'working') {
            const sid = String(st.id ?? '');
            if (st.display === 'placed' || st.display === 'partial')
              actions += btn('orderUnplace', sym, sid, '発注を取り消した');
            actions += btn('orderCancelled', sym, sid, '取消');
          }
          return (
            `<li class="os-stage${muted ? ' os-stage--muted' : ''}">` +
            `<span class="os-stage-txt">${escapeHTML(String(st?.id ?? ''))} ${side}${escapeHTML(fmtLimit(st?.limit))}×${escapeHTML(fmtQty(st?.qty))} ` +
            `<span class="os-sub">${escapeHTML(label)}</span>${auto}</span>${
              actions ? `<span class="os-actions">${actions}</span>` : ''
            }</li>`
          );
        })
        .join('');
      return `<div class="os-lad">${head}${note}${notes}<ul class="os-stages">${stages}</ul></div>`;
    })
    .join('');
  return `<details class="os-card os-ladders"><summary class="os-card-title">はしご全体（${ladders.length} 銘柄）</summary>${items}</details>`;
}

/**
 * 日時の表示（ローカル時刻 YYYY-MM-DD HH:MM）
 * @param {string|null|undefined} iso
 */
export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 注文表全体の HTML
 * @param {any} sheet GET /order-sheet の応答
 * @param {{masked: boolean, busy?: boolean}} opts
 */
export function renderOrderSheetHTML(sheet, opts) {
  const masked = !!opts?.masked;
  const meta = sheet?.meta || {};
  const rows = buildOrderRows(sheet);
  const sum = summarizeRows(rows);
  const sumParts = [`要発注 ${sum.toPlace}`, `発注中 ${sum.placed}`];
  if (sum.holdCancel) sumParts.push(`取消を検討 ${sum.holdCancel}`);
  const warnings = Array.isArray(meta.warnings) ? meta.warnings : [];
  const warnHtml = warnings.length
    ? `<details class="os-warnings"><summary>注意 ${warnings.length} 件</summary><ul>${warnings
        .map((w) => `<li>${escapeHTML(maskDollarText(String(w), masked))}</li>`)
        .join('')}</ul></details>`
    : '';
  const review = sheet?.review?.lastEvent
    ? `<div class="os-foot">最終見直し: ${escapeHTML(String(sheet.review.lastEvent))} ・ ${escapeHTML(fmtDateTime(sheet.review.lastAt))}</div>`
    : '';
  const lagNote = String(meta.holdingsLagNote || 'MF の同期は寄付前のため、直近の約定は未反映の可能性があります');
  return [
    `<div class="os-wrap${opts?.busy ? ' os-busy' : ''}">`,
    '<div class="os-head">',
    `<div class="os-title">注文表 <span class="os-sub">${escapeHTML(sumParts.join(' ・ '))}</span></div>`,
    '<button type="button" class="os-btn" data-action="orderReload">再読み込み</button></div>',
    `<div class="os-asof">MF ${escapeHTML(String(meta.holdingsAsOf ?? '—'))} 同期 ・ 計算 ${escapeHTML(fmtDateTime(sheet?.asOf))} ・ rev ${escapeHTML(String(meta.planRev ?? '—'))}</div>`,
    `<div class="os-note">ⓘ ${escapeHTML(lagNote)}</div>`,
    renderGuardPills(sheet),
    warnHtml,
    '<div class="os-section-title">今出す注文</div>',
    renderOrdersTable(rows, masked),
    renderFunding(sheet, masked),
    renderAiTech(sheet),
    renderStress(sheet),
    renderLadders(sheet, masked),
    review,
    '</div>',
  ].join('');
}

/**
 * 案内・エラー表示
 * @param {'nologin'|'empty'|'loading'|'error'} kind
 * @param {string} [detail]
 */
export function renderOrderSheetMessage(kind, detail) {
  const text = {
    nologin: 'PIN でログインすると注文表を表示します。',
    empty: '注文表の設定（plan）がまだ投入されていません。',
    loading: '注文表を読み込み中…',
    error: '注文表を取得できませんでした。',
  }[kind];
  const d = detail ? `<div class="os-sub">${escapeHTML(detail)}</div>` : '';
  const reload =
    kind === 'error' ? '<button type="button" class="os-btn" data-action="orderReload">再読み込み</button>' : '';
  return `<div class="os-msg${kind === 'error' ? ' os-msg--err' : ''}">${escapeHTML(text)}${d}${reload}</div>`;
}

/**
 * data-arg（"SYM:stageId"）を分解する。シンボルに ":" は入らない（SYMBOL_RE）。
 * @param {unknown} arg
 * @returns {{symbol: string, stageId: string}|null}
 */
export function parseStageArg(arg) {
  if (typeof arg !== 'string') return null;
  const i = arg.indexOf(':');
  if (i <= 0 || i === arg.length - 1) return null;
  return { symbol: arg.slice(0, i), stageId: arg.slice(i + 1) };
}

/**
 * 確認モーダルの文言用に段の情報を探す（orders → ladders の順）
 * @param {any} sheet
 * @param {string} symbol
 * @param {string} stageId
 * @returns {{side: string, limit: number|null, qty: number|null}|null}
 */
export function findStage(sheet, symbol, stageId) {
  const o = (Array.isArray(sheet?.orders) ? sheet.orders : []).find(
    (x) => x && x.symbol === symbol && x.stageId === stageId
  );
  if (o) return { side: o.side, limit: o.limit ?? null, qty: o.qty ?? null };
  const l = (Array.isArray(sheet?.ladders) ? sheet.ladders : []).find((x) => x && x.symbol === symbol);
  const st = l && Array.isArray(l.stages) ? l.stages.find((s) => s && s.id === stageId) : null;
  if (st) return { side: st.side, limit: st.limit ?? null, qty: st.qty ?? null };
  return null;
}

/** 申告の種類ごとの文言 */
export const EVENT_VERB = {
  placed: '発注済みにします',
  filled: '約定にします',
  cancelled: '取消（この段をスキップ）にします',
  unplace: '要発注に戻します（証券会社で注文を取り消した）',
};

/**
 * 確認モーダルの本文（例「AAA 買 $368×81 を約定にします」）
 * @param {any} sheet
 * @param {'placed'|'filled'|'cancelled'|'unplace'} type
 * @param {string} symbol
 * @param {string} stageId
 */
export function confirmMessage(sheet, type, symbol, stageId) {
  const st = findStage(sheet, symbol, stageId);
  const desc = st ? `${st.side === 'sell' ? '売' : '買'} ${fmtLimit(st.limit)}×${fmtQty(st.qty)}` : stageId;
  return `${symbol} ${desc} を${EVENT_VERB[type] || type}`;
}
