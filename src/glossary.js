// @ts-check

// ══════════════════════════════════════════════════════════════
// glossary.js ―― アプリ内「用語解説」の描画（#445）
//
// glossary-data.js の構造化データを、二段アコーディオン（native details）で描画する。
// 外側 details（タブ全体）→ 内側 details（カテゴリ別）→ 各用語 <p>。
// CSP 安全（JS開閉や inline onclick を使わない native details のみ）。
// ══════════════════════════════════════════════════════════════

import { GLOSSARY } from './glossary-data.js';
import { escapeHTML } from './utils.js';

/**
 * 指定タブ用の用語解説 HTML を返す（二段アコーディオン）。
 * tab='value' なら tab:'both'＋'value' カテゴリ、'risk' なら 'both'＋'risk' カテゴリ。
 * @param {'value'|'risk'} tab
 * @returns {string}
 */
export function glossaryHTML(tab) {
  const cats = GLOSSARY.filter((c) => c.tab === 'both' || c.tab === tab);

  const catsHTML = cats
    .map((cat) => {
      const termsHTML = cat.terms
        .map((t) => `<p><b>${escapeHTML(t.term)}</b>：${escapeHTML(t.desc)}</p>`)
        .join('');
      return `<details class="gloss-cat">
      <summary>${escapeHTML(cat.title)}</summary>
      <div class="gloss-cat-body">${termsHTML}</div>
    </details>`;
    })
    .join('');

  return `<details class="gloss">
    <summary>📘 用語解説（タップで開く）</summary>
    <div class="gloss-body">${catsHTML}</div>
  </details>`;
}
