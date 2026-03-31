const DEFAULT_NAMESPACE = 'jarnox';
const AUTH_USER_STORAGE_KEY = 'jarnox-auth-user';

function sanitizeSegment(value, fallback = 'global') {
  const text = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return text || fallback;
}

function readStoredUserSegment() {
  if (typeof window === 'undefined') return 'anonymous';

  const raw =
    window.localStorage.getItem(AUTH_USER_STORAGE_KEY) ||
    window.sessionStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) return 'anonymous';

  try {
    const parsed = JSON.parse(raw);
    return sanitizeSegment(
      parsed?.id || parsed?.email || parsed?.full_name,
      'anonymous',
    );
  } catch {
    return 'anonymous';
  }
}

function getRuntimeNamespace() {
  const fromEnv =
    import.meta.env.VITE_SEARCH_NAMESPACE ||
    import.meta.env.VITE_APP_NAMESPACE ||
    import.meta.env.REACT_APP_SEARCH_NAMESPACE ||
    import.meta.env.REACT_APP_NAME;

  if (fromEnv) {
    return sanitizeSegment(fromEnv, DEFAULT_NAMESPACE);
  }

  if (typeof window !== 'undefined') {
    return sanitizeSegment(window.location.hostname, DEFAULT_NAMESPACE);
  }

  return DEFAULT_NAMESPACE;
}

function buildStorageKey(scope, leaf) {
  return `${getRuntimeNamespace()}:${readStoredUserSegment()}:${scope}:${leaf}`;
}

function buildEventName(topic) {
  return `${getRuntimeNamespace()}:${readStoredUserSegment()}:event:${topic}`;
}

export function getDashboardSearchStorageKey() {
  return buildStorageKey('stock-dashboard', 'search');
}

export function getMarketplaceSearchStorageKey() {
  return buildStorageKey('marketplace', 'search');
}

export function getDashboardSearchEventName() {
  return buildEventName('dashboard-search-change');
}

export function getMarketplaceSearchEventName() {
  return buildEventName('marketplace-search-change');
}
