// ══════════════════════════════════════════════════════════════
// fmt.js  ―  フォーマッター関数群（依存ゼロ）
// 純関数のみ。DOM や D3 に依存しないため vitest で直接テスト可能。
// ══════════════════════════════════════════════════════════════

const _ESC = {
  '&': '&' + 'amp;',
  '<': '&' + 'lt;',
  '>': '&' + 'gt;',
  '"': '&' + 'quot;',
  "'": '&' + '#39;',
};

const escapeHTML = s => String(s).replace(/[&<>"']/g, c => _ESC[c]);

const fmtJPY = v => {
  const m = v / 10000;
  return `${m.toFixed(1)  }\u4e07`;
};

const fmtJPYFull = v => `${(v >= 0 ? '+' : '') + Math.round(v).toLocaleString()  }\u5186`;

// 1\u5186\u5358\u4f4d\u30fb\u30ab\u30f3\u30de\u533a\u5207\u308a\u306e\u5186\u8868\u8a18\uff08\u7b26\u53f7\u306a\u3057\u30fb\u00a5\u524d\u7f6e\uff09\u3002\u8cc7\u7523\u7dcf\u984d\u30d0\u30fc\u3067\u4f7f\u7528\u3002
const fmtYen = v => `\u00a5${  Math.round(v || 0).toLocaleString()}`;

// \u30de\u30cd\u30fc\u30d5\u30a9\u30ef\u30fc\u30c9\u5f0f\u30de\u30b9\u30af: \u6570\u5b57\u306e\u307f\u3092 * \u306b\u7f6e\u63db\u3057\u3001\u30ab\u30f3\u30de\u30fb\u00a5\u30fb\u8a18\u53f7\u306f\u6b8b\u3059\u3002
// \u4f8b: "\u00a5524,345,245" -> "\u00a5***,***,***"
const maskAmount = s => String(s).replace(/[0-9]/g, '*');

const fmtPct = v => `${v.toFixed(1)  }%`;

const fmtPrice = (v, cur) => {
  if (v == null) return '\u2015';
  return cur === 'USD' ? `$${  v.toFixed(2)}` : `\u00a5${  Math.round(v).toLocaleString()}`;
};

const sgn = v => v >= 0 ? 'pos' : 'neg';

const fmtJPYInt = v => {
  const m = Math.round(v / 10000);
  const sign = m < 0 ? '-' : '';
  const abs = Math.abs(m);
  if (abs >= 10000) {
    const s = (abs / 10000).toFixed(2);
    return `${sign + (s.endsWith('0') ? (abs / 10000).toFixed(1) : s)  }\u5104`;
  }
  return `${sign + abs.toLocaleString()  }\u4e07`;
};

const fmtPctInt = v => `${Math.round(v)  }%`;

const fmtShares = n => {
  if (n >= 1000000) {
    const v = Math.round(n / 100000) / 10;
    return `${v.toFixed(1).replace(/\.0$/, '')  }M`;
  }
  if (n >= 1000) {
    const v = Math.round(n / 100) / 10;
    return `${v.toFixed(1).replace(/\.0$/, '')  }K`;
  }
  return n.toLocaleString();
};

function getColor(pct, mode, scaleOverride) {
  if (pct == null) return 'var(--null-cell)';
  const scale = scaleOverride != null ? scaleOverride : (mode === 'pnl' ? 50 : 5);
  const t = Math.max(-1, Math.min(1, pct / scale));
  if (t >= 0) {
    const r = Math.round(232 + t * (198 - 232));
    const g = Math.round(232 + t * (40 - 232));
    const b = Math.round(237 + t * (40 - 237));
    return `rgb(${r},${g},${b})`;
  } else {
    const r = Math.round(232 - (-t) * (232 - 27));
    const g = Math.round(232 - (-t) * (232 - 94));
    const b = Math.round(237 - (-t) * (237 - 32));
    return `rgb(${r},${g},${b})`;
  }
}

export { escapeHTML, fmtJPY, fmtJPYFull, fmtYen, maskAmount, fmtPct, fmtPrice, sgn, fmtJPYInt, fmtPctInt, fmtShares, getColor };
