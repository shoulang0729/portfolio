export function validatePosition(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Position must be an object');
  }

  if (typeof obj.symbol !== 'string' || !obj.symbol.trim()) {
    throw new Error('Position.symbol is required (non-empty string)');
  }

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    throw new Error('Position.name is required (non-empty string)');
  }

  if (typeof obj.cat !== 'string' || !obj.cat.trim()) {
    throw new Error('Position.cat is required (non-empty string)');
  }

  if (typeof obj.shares !== 'number' || !isFinite(obj.shares)) {
    throw new Error('Position.shares must be a finite number');
  }

  if (typeof obj.price !== 'number' || !isFinite(obj.price)) {
    throw new Error('Position.price must be a finite number');
  }

  if (typeof obj.avgCost !== 'number' || !isFinite(obj.avgCost)) {
    throw new Error('Position.avgCost must be a finite number');
  }

  if (typeof obj.value !== 'number' || !isFinite(obj.value)) {
    throw new Error('Position.value must be a finite number');
  }

  if (typeof obj.pnl !== 'number' || !isFinite(obj.pnl)) {
    throw new Error('Position.pnl must be a finite number');
  }

  if (typeof obj.pnlPct !== 'number' || !isFinite(obj.pnlPct)) {
    throw new Error('Position.pnlPct must be a finite number');
  }

  if (typeof obj.cur !== 'string' || !obj.cur.trim()) {
    throw new Error('Position.cur is required (non-empty string)');
  }

  if (typeof obj.ySymbol !== 'string' || !obj.ySymbol.trim()) {
    throw new Error('Position.ySymbol is required (non-empty string)');
  }

  if (obj.dayPct !== null && obj.dayPct !== undefined) {
    if (typeof obj.dayPct !== 'number' || !isFinite(obj.dayPct)) {
      throw new Error('Position.dayPct must be null or a finite number');
    }
  }

  if (obj.dayCh !== null && obj.dayCh !== undefined) {
    if (typeof obj.dayCh !== 'number' || !isFinite(obj.dayCh)) {
      throw new Error('Position.dayCh must be null or a finite number');
    }
  }

  if (obj.isProxy !== undefined && typeof obj.isProxy !== 'boolean') {
    throw new Error('Position.isProxy must be a boolean or undefined');
  }

  if (obj.proxyName !== undefined && (typeof obj.proxyName !== 'string' && obj.proxyName !== null)) {
    throw new Error('Position.proxyName must be a string, null, or undefined');
  }

  return obj;
}

export function validateWatchlistItem(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Watchlist item must be an object');
  }

  if (typeof obj.symbol !== 'string' || !obj.symbol.trim()) {
    throw new Error('Watchlist item.symbol is required (non-empty string)');
  }

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    throw new Error('Watchlist item.name is required (non-empty string)');
  }

  if (typeof obj.exchange !== 'string' || !obj.exchange.trim()) {
    throw new Error('Watchlist item.exchange is required (non-empty string)');
  }

  if (typeof obj.type !== 'string' || !obj.type.trim()) {
    throw new Error('Watchlist item.type is required (non-empty string)');
  }

  if (typeof obj.cur !== 'string' || !obj.cur.trim()) {
    throw new Error('Watchlist item.cur is required (non-empty string)');
  }

  return obj;
}

export function validateSnapshot(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Snapshot must be an object');
  }

  if (typeof obj.asOf !== 'string') {
    throw new Error('Snapshot.asOf is required (ISO string)');
  }

  if (typeof obj.source !== 'string' || !obj.source.trim()) {
    throw new Error('Snapshot.source is required (non-empty string)');
  }

  if (!obj.summary || typeof obj.summary !== 'object') {
    throw new Error('Snapshot.summary is required (object)');
  }

  const summary = obj.summary;
  if (typeof summary.totalValue !== 'number' || !isFinite(summary.totalValue)) {
    throw new Error('Snapshot.summary.totalValue must be a finite number');
  }

  if (typeof summary.totalPnl !== 'number' || !isFinite(summary.totalPnl)) {
    throw new Error('Snapshot.summary.totalPnl must be a finite number');
  }

  if (summary.totalPnlPct !== null && summary.totalPnlPct !== undefined) {
    if (typeof summary.totalPnlPct !== 'number' || !isFinite(summary.totalPnlPct)) {
      throw new Error('Snapshot.summary.totalPnlPct must be null or a finite number');
    }
  }

  if (typeof summary.positionCount !== 'number' || !Number.isInteger(summary.positionCount) || summary.positionCount < 0) {
    throw new Error('Snapshot.summary.positionCount must be a non-negative integer');
  }

  if (typeof summary.watchlistCount !== 'number' || !Number.isInteger(summary.watchlistCount) || summary.watchlistCount < 0) {
    throw new Error('Snapshot.summary.watchlistCount must be a non-negative integer');
  }

  if (typeof summary.currencyBase !== 'string' || !summary.currencyBase.trim()) {
    throw new Error('Snapshot.summary.currencyBase is required (non-empty string)');
  }

  if (!Array.isArray(obj.positions)) {
    throw new Error('Snapshot.positions must be an array');
  }

  for (let i = 0; i < obj.positions.length; i++) {
    try {
      validatePosition(obj.positions[i]);
    } catch (e) {
      throw new Error(`Snapshot.positions[${i}]: ${e.message}`);
    }
  }

  if (!Array.isArray(obj.watchlist)) {
    throw new Error('Snapshot.watchlist must be an array');
  }

  for (let i = 0; i < obj.watchlist.length; i++) {
    const item = obj.watchlist[i];
    if (!item || typeof item !== 'object') {
      throw new Error(`Snapshot.watchlist[${i}] must be an object`);
    }
    if (typeof item.symbol !== 'string' || !item.symbol.trim()) {
      throw new Error(`Snapshot.watchlist[${i}].symbol is required (non-empty string)`);
    }
    if (typeof item.name !== 'string' || !item.name.trim()) {
      throw new Error(`Snapshot.watchlist[${i}].name is required (non-empty string)`);
    }
  }

  return obj;
}
