import { getApiBaseUrl } from 'api/apiBase';

const API_BASE = getApiBaseUrl();

async function fetchJson(path, query = {}) {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });

  const querySuffix = search.toString() ? `?${search.toString()}` : '';
  const response = await fetch(`${API_BASE}${path}${querySuffix}`);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${path}`);
  }
  return response.json();
}

export function fetchTopCryptoMarket(limit = 7, vsCurrency = 'usd') {
  return fetchJson('/market/crypto/top', {
    limit,
    vs_currency: vsCurrency,
  });
}

export function fetchAllCryptoMarket(vsCurrency = 'usd') {
  return fetchJson('/market/crypto/all', {
    vs_currency: vsCurrency,
  });
}

export function fetchCryptoHistory(coinId, vsCurrency = 'usd', days = 30) {
  return fetchJson(`/market/crypto/history/${encodeURIComponent(coinId)}`, {
    vs_currency: vsCurrency,
    days,
  });
}

export function fetchTopNftMarket(limit = 7) {
  return fetchJson('/market/nft/top', { limit });
}

export function fetchAllNftMarket() {
  return fetchJson('/market/nft/all');
}

export function fetchNftHistory(nftId, vsCurrency = 'usd', days = 30) {
  return fetchJson(`/market/nft/history/${encodeURIComponent(nftId)}`, {
    vs_currency: vsCurrency,
    days,
  });
}
