const DEV_FALLBACK_API_BASE = 'http://localhost:8000';

function trimTrailingSlash(value) {
  return value.replace(/\/$/, '');
}

export function getApiBaseUrl() {
  const fromVite = import.meta.env.VITE_API_BASE_URL;
  const fromCra = import.meta.env.REACT_APP_API_BASE_URL;
  const configured = (fromVite || fromCra || '').trim();

  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (import.meta.env.DEV) {
    return DEV_FALLBACK_API_BASE;
  }

  throw new Error(
    'Missing API base URL. Set VITE_API_BASE_URL for production builds.',
  );
}
