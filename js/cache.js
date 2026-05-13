import { TTL, CONSISTENCY_WINDOW_S } from "./config.js";

const store = new Map();

export function getCached(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if ((Date.now() - entry.fetched_at) > entry.ttl * 1000) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function setCache(key, result, intent) {
  store.set(key, { ...result, ttl: TTL[intent] || 60 });
}

export function checkConsistency(results) {
  const times = Object.values(results).map(r => r.fetched_at);
  const skewMs = Math.max(...times) - Math.min(...times);
  return {
    skewSeconds: Math.round(skewMs / 1000),
    warning: skewMs > CONSISTENCY_WINDOW_S * 1000
  };
}
