// ══════════════════════════════════════════════════════════════
// positions-store.js  ―  保有銘柄の KV 永続化と差分計算
//
// 依存: data.js (WORKER_URL, fetchWithTimeout), positions.js (positions)
// ══════════════════════════════════════════════════════════════

const DEFAULT_PIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'; // SHA-256 of "1234"

async function loadPositionsFromKV() {
  try {
    const res = await fetchWithTimeout(`${WORKER_URL}/positions`, 10000);
    if (!res.ok) return false;
    const kvPositions = await res.json();
    if (!Array.isArray(kvPositions) || kvPositions.length === 0) return false;
    positions.splice(0, positions.length, ...kvPositions);
    console.log(`[positions-store] KVから${kvPositions.length}銘柄を読み込みました`);
    return true;
  } catch (e) {
    console.warn('[positions-store] KV positions 読込失敗:', e);
    return false;
  }
}

async function savePositionsToKV(newPositions, pinHashOverride) {
  const pinHash = pinHashOverride
    || localStorage.getItem('hm-pin-hash')
    || DEFAULT_PIN_HASH;
  const res = await fetchWithTimeout(`${WORKER_URL}/positions`, 30000, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Pin-Hash': pinHash },
    body: JSON.stringify(newPositions),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `保存失敗 (HTTP ${res.status})`);
  }
  return (await res.json()).ok === true;
}

function computeImportDiff(current, incoming) {
  const keyOf = p => p.symbol;
  const curMap = new Map(current.map(p => [keyOf(p), p]));
  const newMap = new Map(incoming.map(p => [keyOf(p), p]));

  const added    = incoming.filter(p => !curMap.has(keyOf(p)));
  const removed  = current.filter(p => !newMap.has(keyOf(p)));
  const changed  = incoming.filter(p => {
    const c = curMap.get(keyOf(p));
    return c && (c.shares !== p.shares || c.avgCost !== p.avgCost);
  });
  const unchanged = incoming.filter(p => {
    const c = curMap.get(keyOf(p));
    return c && c.shares === p.shares && c.avgCost === p.avgCost;
  });

  return { added, removed, changed, unchanged };
}
