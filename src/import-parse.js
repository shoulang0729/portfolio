// ══════════════════════════════════════════════════════════════
// import-parse.js  ―  資産パース（マネックスCSV / マネフォ画像）
//
// 純粋なパース層。UI/KV保存はここに含まない。
//
// 依存: csv.js (parseCsvText, normalizeStr, parseNum, detectCsvType),
//       funds.js (fundSymbolFromName, fundProxyOf),
//       data.js (WORKER_URL, fetchWithTimeout)
// ══════════════════════════════════════════════════════════════

import { parseCsvText, normalizeStr, parseNum, detectCsvType } from './csv.js';
import { fundSymbolFromName, fundProxyOf } from './funds.js';
import { WORKER_URL } from './config.js';
import { fetchWithTimeout } from './data.js';

const FUND_FALLBACK_PROXY = { ySymbol: '^N225', proxyName: '日経平均' };

// ── マネックス CSV → フル Position オブジェクト ─────────────────────────────

function buildJpPosition(row) {
  const symbol  = row[3]?.trim();
  const name    = normalizeStr(row[2]?.trim() || '');
  if (!symbol || !name) return null;
  const avgCost = parseNum(row[8]);
  const shares  = parseNum(row[9]);
  const price   = parseNum(row[7]);
  const value   = parseNum(row[12]);
  const pnl     = parseNum(row[13]);
  const pnlPct  = (avgCost && shares && avgCost > 0)
    ? (pnl ?? 0) / (avgCost * shares) * 100 : null;
  return {
    symbol, name, cat: '日本株・ETF',
    shares: shares ?? 0, price: price ?? 0,
    avgCost: avgCost ?? 0, value: value ?? 0,
    pnl: pnl ?? 0, pnlPct: pnlPct ?? 0,
    dayPct: null, dayCh: null, cur: 'JPY',
    ySymbol: `${symbol}.T`,
  };
}

function buildUsPosition(row) {
  const name   = normalizeStr(row[0]?.trim() || '');
  const ticker = row[1]?.trim();
  if (!ticker || !name) return null;
  const shares  = parseNum(row[4]);
  const avgCost = parseNum(row[7]);
  const price   = parseNum(row[10]);
  const value   = parseNum(row[16]);
  const pnl     = parseNum(row[18]);
  const pnlPct  = (value != null && pnl != null && value - pnl !== 0)
    ? (pnl / (value - pnl)) * 100 : null;
  return {
    symbol: ticker, name, cat: '米国株・ETF',
    shares: shares ?? 0, price: price ?? 0,
    avgCost: avgCost ?? 0, value: value ?? 0,
    pnl: pnl ?? 0, pnlPct: pnlPct ?? 0,
    dayPct: null, dayCh: null, cur: 'USD',
    ySymbol: ticker,
  };
}

function buildFundPosition(row) {
  const rawName = row[2]?.trim();
  if (!rawName) return null;
  const name   = normalizeStr(rawName);
  const symbol = fundSymbolFromName(name);
  if (!symbol) return null;
  // row[7]=保有口数[口] → 万口に変換して price/avgCost (円/万口) と一致させる
  const sharesRaw = parseNum(row[7]);
  const shares  = sharesRaw != null ? Math.round(sharesRaw / 10000 * 10000) / 10000 : null;
  const avgCost = parseNum(row[11]);
  const price   = parseNum(row[5]);
  const value   = parseNum(row[12]);
  const pnl     = parseNum(row[13]);
  const cost    = (value != null && pnl != null) ? value - pnl : null;
  const pnlPct  = (cost != null && cost !== 0) ? pnl / cost * 100 : null;
  const proxy   = fundProxyOf(symbol) ?? FUND_FALLBACK_PROXY;
  return {
    symbol, name, cat: '投資信託',
    shares: shares ?? 0, price: price ?? 0,
    avgCost: avgCost ?? 0, value: value ?? 0,
    pnl: pnl ?? 0, pnlPct: pnlPct ?? 0,
    dayPct: null, dayCh: null, cur: 'JPY',
    ySymbol: proxy.ySymbol, isProxy: true, proxyName: proxy.proxyName,
  };
}

async function parseManexFiles(files) {
  const results = [];
  for (const file of files) {
    try {
      const buf  = await file.arrayBuffer();
      const text = new TextDecoder('shift-jis').decode(buf);
      const rows = parseCsvText(text);
      if (rows.length < 2) continue;
      const type = detectCsvType(rows[0]);
      if (!type) continue;
      for (let i = 1; i < rows.length; i++) {
        const pos = type === 'jp'   ? buildJpPosition(rows[i])
                  : type === 'us'   ? buildUsPosition(rows[i])
                  : buildFundPosition(rows[i]);
        if (pos) results.push(pos);
      }
    } catch (e) {
      console.error('[import] CSV parse error:', file.name, e);
    }
  }
  return results;
}

// ── マネーフォワード スクショ → GPT-4o Vision ────────────────────────────

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
// base64 20MB 上限に合わせてソースファイルは 16MB 以内を推奨
const MAX_IMAGE_BYTES = 16_000_000;

async function parseMoneyForwardImage(file) {
  const mime = file.type || 'image/png';
  if (!SUPPORTED_IMAGE_TYPES.includes(mime.toLowerCase())) {
    throw new Error(`非対応の画像形式です（${mime}）。JPEG または PNG 形式のスクリーンショットを使用してください。`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`画像サイズが大きすぎます（${(file.size / 1024 / 1024).toFixed(1)} MB）。16 MB 以下の画像を使用してください。`);
  }

  const buf   = await file.arrayBuffer();
  const uint8 = new Uint8Array(buf);
  let binaryStr = '';
  for (let i = 0; i < uint8.length; i += 8192) {
    binaryStr += String.fromCharCode(...uint8.subarray(i, i + 8192));
  }
  const b64 = btoa(binaryStr);

  const prompt = `このスクリーンショットは資産管理アプリの保有資産一覧です。
画像から保有資産を抽出し、必ず以下のJSON形式のみで回答してください（説明文不要）:
{"assets":[{"symbol":"コードorティッカー","name":"銘柄名","shares":保有数,"avgCost":平均取得単価,"price":現在値or基準価額,"value":時価評価額,"category":"日本株|米国株|投資信託|その他"}]}

注意:
- 数値はカンマや通貨記号を除いた数値のみ（例: 1,234,567 → 1234567）
- 不明な項目は 0 にする
- 投資信託は「保有口数」を shares、「基準価額」を price、「平均取得単価」を avgCost、「時価評価額」を value に
- 同じ銘柄が複数行ある場合はそれぞれ別レコードとして抽出（合算は後段でやる）`;

  const body = {
    model: 'gpt-4o',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
        { type: 'text', text: prompt },
      ],
    }],
  };

  const res = await fetchWithTimeout(`${WORKER_URL}/ai/openai`, 30000, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try { const e = await res.json(); detail = e?.error?.message || JSON.stringify(e); } catch {}
    throw new Error(`AI API エラー (${res.status})${detail ? `: ${  detail}` : ''}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const m    = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AIのレスポンスからJSONを抽出できませんでした。別のスクリーンショットをお試しください。');
  const parsed = JSON.parse(m[0]);
  return (parsed.assets || []).map(a => _mfAssetToPosition(a)).filter(Boolean);
}

export { parseManexFiles, parseMoneyForwardImage };

function _mfAssetToPosition(a) {
  if (!a.name) return null;
  const name = String(a.name).trim();
  const cat = a.category === '米国株' ? '米国株・ETF'
            : a.category === '投資信託' ? '投資信託'
            : '日本株・ETF';
  const isJP   = cat === '日本株・ETF';
  const isFund = cat === '投資信託';

  // GPT-4oがsymbolを空で返す場合、投資信託は名前パターンでマッチ
  let sym = String(a.symbol || '').trim();
  if (!sym && isFund) {
    sym = fundSymbolFromName(name) || '';
  }
  if (!sym) sym = name;

  const proxy   = isFund ? (fundProxyOf(sym) ?? FUND_FALLBACK_PROXY) : null;
  let   shares  = Number(a.shares)  || 0;
  const avgCost = Number(a.avgCost) || 0;
  let   price   = Number(a.price)   || 0;
  let   value   = Number(a.value)   || 0;

  // 投資信託の単位正規化:
  //   内部表現は CSV パスに合わせて「万口」で統一する（avgCost/price は 円/万口）。
  //   GPT-4o が "687,800口" を 687800 として返すと、shares × avgCost が 10000倍 大きくなる。
  //   value が取れていれば比率で判定、無ければ shares のオーダーで heuristic 判定。
  if (isFund && shares > 0) {
    if (value > 0 && avgCost > 0) {
      // shares × avgCost が value より 1000倍 以上大きい → 単位が「口」 → 万口へ変換
      if (shares * avgCost > value * 1000) shares = shares / 10000;
    } else if (shares >= 10000) {
      // value 情報なしでも、shares が 1万 を超えるなら「口」 単位とみなす
      shares = shares / 10000;
    }
  }

  // value が取れていなければ shares × avgCost で推定（基準価額ベースの概算）
  if (value === 0 && shares > 0 && avgCost > 0) value = shares * avgCost;

  // price が無ければ avgCost を初期値として使う（refreshPrices でライブ更新される）
  if (price === 0 && avgCost > 0) price = avgCost;

  const pnl    = (price > 0 && avgCost > 0 && shares > 0) ? (price - avgCost) * shares : 0;
  const pnlPct = (avgCost > 0 && shares > 0) ? (pnl / (avgCost * shares)) * 100 : 0;

  return {
    symbol: sym, name, cat,
    shares, price, avgCost, value, pnl, pnlPct,
    dayPct: null, dayCh: null,
    cur: cat === '米国株・ETF' ? 'USD' : 'JPY',
    ySymbol: isFund ? proxy.ySymbol : (isJP ? `${sym.replace(/\.T$/i, '')}.T` : sym),
    ...(isFund ? { isProxy: true, proxyName: proxy.proxyName } : {}),
  };
}
