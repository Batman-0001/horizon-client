import { getAuthToken } from 'api/authApi';
import { getApiBaseUrl } from 'api/apiBase';

const API_BASE = getApiBaseUrl();

const CACHE_PREFIX = 'jarnox-stock-cache:v2:';
const ttlByPath = {
  '/companies': 12 * 60 * 60 * 1000,
  '/market/highlights': 10 * 60 * 1000,
  '/analytics/event-impact': 10 * 60 * 1000,
  '/summary': 30 * 60 * 1000,
  '/data': 5 * 60 * 1000,
  '/ml/forecast': 15 * 60 * 1000,
  '/ml/strategy/recommendation': 10 * 60 * 1000,
  '/ml/strategy/recommendation/history': 60 * 1000,
  '/ml/alerts': 30 * 1000,
};

const memoryCache = new Map();
const inflightRequests = new Map();

function resolveTtl(path) {
  if (path.startsWith('/summary/')) return ttlByPath['/summary'];
  if (path.startsWith('/data/')) return ttlByPath['/data'];
  if (path.startsWith('/ml/forecast/')) return ttlByPath['/ml/forecast'];
  if (path.startsWith('/ml/strategy/recommendation/history')) {
    return ttlByPath['/ml/strategy/recommendation/history'];
  }
  if (path.startsWith('/ml/alerts')) {
    return ttlByPath['/ml/alerts'];
  }
  if (path.startsWith('/ml/strategy/recommendation')) {
    return ttlByPath['/ml/strategy/recommendation'];
  }
  return ttlByPath[path] ?? 5 * 60 * 1000;
}

function makeCacheKey(path, query) {
  const search = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const querySuffix = search.toString() ? `?${search.toString()}` : '';
  return `${path}${querySuffix}`;
}

function getStorageKey(cacheKey) {
  return `${CACHE_PREFIX}${cacheKey}`;
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage);
}

function writeCache(cacheKey, data, ttlMs) {
  const expiresAt = Date.now() + ttlMs;
  const record = { data, expiresAt };
  memoryCache.set(cacheKey, record);

  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(
      getStorageKey(cacheKey),
      JSON.stringify(record),
    );
  } catch {
    // Ignore storage write failures (e.g. private mode or quota exceeded).
  }
}

function readCacheRecord(cacheKey) {
  const now = Date.now();
  const memoRecord = memoryCache.get(cacheKey);
  if (memoRecord) {
    if (memoRecord.expiresAt > now) return memoRecord;
    memoryCache.delete(cacheKey);
  }

  if (!canUseStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.expiresAt <= now) {
      window.sessionStorage.removeItem(getStorageKey(cacheKey));
      return null;
    }
    memoryCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function readCachedData(path, query = {}) {
  const cacheKey = makeCacheKey(path, query);
  const record = readCacheRecord(cacheKey);
  return record ? record.data : null;
}

async function fetchJson(path, query = {}) {
  const cacheKey = makeCacheKey(path, query);
  const cached = readCacheRecord(cacheKey);
  if (cached) {
    return cached.data;
  }

  const inflight = inflightRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const search = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });

  const querySuffix = search.toString() ? `?${search.toString()}` : '';
  const requestPromise = (async () => {
    const response = await fetch(`${API_BASE}${path}${querySuffix}`);

    if (!response.ok) {
      throw new Error(`Request failed (${response.status}): ${path}`);
    }

    const data = await response.json();
    writeCache(cacheKey, data, resolveTtl(path));
    return data;
  })();

  inflightRequests.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inflightRequests.delete(cacheKey);
  }
}

export function fetchCompanies() {
  return fetchJson('/companies');
}

export function fetchStockData(symbol, days) {
  return fetchJson(`/data/${symbol}`, { days });
}

export function fetchStockSummary(symbol) {
  return fetchJson(`/summary/${symbol}`);
}

export function fetchMarketHighlights() {
  return fetchJson('/market/highlights');
}

export function fetchEventImpactAnalytics(lookbackDays = 365, windowDays = 3) {
  return fetchJson('/analytics/event-impact', {
    lookback_days: lookbackDays,
    window_days: windowDays,
  });
}

export function fetchMlForecast(symbol, horizon) {
  return fetchJson(`/ml/forecast/${symbol}`, { horizon });
}

export function fetchStrategyRecommendation({
  primarySymbol,
  secondarySymbol,
  primaryStrategy,
  secondaryStrategy,
  amount,
  lookbackMonths,
}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('You must be logged in to request recommendations.');
  }

  const search = new URLSearchParams({
    primary_symbol: String(primarySymbol),
    secondary_symbol: String(secondarySymbol),
    primary_strategy: String(primaryStrategy),
    secondary_strategy: String(secondaryStrategy),
    amount: String(amount),
    lookback_months: String(lookbackMonths),
  });

  return fetch(`${API_BASE}/ml/strategy/recommendation?${search.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).then(async (response) => {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(
        (payload && payload.detail) ||
          `Request failed (${response.status}): /ml/strategy/recommendation`,
      );
    }
    return payload;
  });
}

export function fetchStrategyRecommendationHistory({
  limit = 8,
  symbol,
  strategy,
  sinceDays,
} = {}) {
  return fetchJson('/ml/strategy/recommendation/history', {
    limit,
    symbol,
    strategy,
    since_days: sinceDays,
  });
}

export function fetchAutomatedAlerts({
  limit = 12,
  symbol,
  sinceHours = 72,
} = {}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('You must be logged in to load personalized alerts.');
  }

  const search = new URLSearchParams({
    limit: String(limit),
    since_hours: String(sinceHours),
  });
  if (symbol) search.set('symbol', String(symbol));

  return fetch(`${API_BASE}/ml/alerts?${search.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).then(async (response) => {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(
        (payload && payload.detail) ||
          `Request failed (${response.status}): /ml/alerts`,
      );
    }
    return payload;
  });
}

export function fetchNotifications({ limit = 20, sinceHours = 168 } = {}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('You must be logged in to load notifications.');
  }

  const search = new URLSearchParams({
    limit: String(limit),
    since_hours: String(sinceHours),
  });

  return fetch(`${API_BASE}/ml/notifications?${search.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).then(async (response) => {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(
        (payload && payload.detail) ||
          `Request failed (${response.status}): /ml/notifications`,
      );
    }
    return payload;
  });
}

export function markNotificationsRead({ notificationIds = [] } = {}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('You must be logged in to update notifications.');
  }

  return fetch(`${API_BASE}/ml/notifications/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ notification_ids: notificationIds }),
  }).then(async (response) => {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(
        (payload && payload.detail) ||
          `Request failed (${response.status}): /ml/notifications/read`,
      );
    }
    return payload;
  });
}

export function updateAlertPreferences({ symbols = [] } = {}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('You must be logged in to update alert preferences.');
  }

  return fetch(`${API_BASE}/ml/alerts/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ symbols }),
  }).then(async (response) => {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(
        (payload && payload.detail) ||
          `Request failed (${response.status}): /ml/alerts/preferences`,
      );
    }
    return payload;
  });
}

export function fetchAlertPreferences() {
  const token = getAuthToken();
  if (!token) {
    throw new Error('You must be logged in to load alert preferences.');
  }

  return fetch(`${API_BASE}/ml/alerts/preferences`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).then(async (response) => {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(
        (payload && payload.detail) ||
          `Request failed (${response.status}): /ml/alerts/preferences`,
      );
    }
    return payload;
  });
}

export function getCachedCompanies() {
  return readCachedData('/companies');
}

export function getCachedStockData(symbol, days) {
  return readCachedData(`/data/${symbol}`, { days });
}

export function getCachedStockSummary(symbol) {
  return readCachedData(`/summary/${symbol}`);
}

export function getCachedMarketHighlights() {
  return readCachedData('/market/highlights');
}

export function getCachedEventImpactAnalytics(
  lookbackDays = 365,
  windowDays = 3,
) {
  return readCachedData('/analytics/event-impact', {
    lookback_days: lookbackDays,
    window_days: windowDays,
  });
}

export function getCachedMlForecast(symbol, horizon) {
  return readCachedData(`/ml/forecast/${symbol}`, { horizon });
}

export function getCachedStrategyRecommendation({
  primarySymbol,
  secondarySymbol,
  primaryStrategy,
  secondaryStrategy,
  amount,
  lookbackMonths,
}) {
  return readCachedData('/ml/strategy/recommendation', {
    primary_symbol: primarySymbol,
    secondary_symbol: secondarySymbol,
    primary_strategy: primaryStrategy,
    secondary_strategy: secondaryStrategy,
    amount,
    lookback_months: lookbackMonths,
  });
}
