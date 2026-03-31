import { getApiBaseUrl } from 'api/apiBase';

const API_BASE = getApiBaseUrl();

const AUTH_TOKEN_KEY = 'jarnox-auth-token';
const AUTH_USER_KEY = 'jarnox-auth-user';

function getStorage(remember) {
  if (typeof window === 'undefined') return null;
  return remember ? window.localStorage : window.sessionStorage;
}

function getAnyToken() {
  if (typeof window === 'undefined') return null;
  return (
    window.localStorage.getItem(AUTH_TOKEN_KEY) ||
    window.sessionStorage.getItem(AUTH_TOKEN_KEY)
  );
}

export function getAuthToken() {
  return getAnyToken();
}

function updateSessionValue(key, value) {
  if (typeof window === 'undefined') return;

  const hasLocalToken = Boolean(window.localStorage.getItem(AUTH_TOKEN_KEY));
  const hasSessionToken = Boolean(
    window.sessionStorage.getItem(AUTH_TOKEN_KEY),
  );

  if (hasLocalToken) {
    window.localStorage.setItem(key, value);
  }
  if (hasSessionToken) {
    window.sessionStorage.setItem(key, value);
  }

  if (!hasLocalToken && !hasSessionToken) {
    window.localStorage.setItem(key, value);
  }
}

function parseErrorMessage(errorPayload, fallback) {
  if (!errorPayload) return fallback;
  if (typeof errorPayload === 'string') return errorPayload;
  if (typeof errorPayload.detail === 'string') return errorPayload.detail;
  return fallback;
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      parseErrorMessage(payload, `Request failed (${response.status})`),
    );
  }

  return payload;
}

export function saveAuthSession(token, user, remember = false) {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
  window.sessionStorage.removeItem(AUTH_USER_KEY);

  const storage = getStorage(remember);
  if (!storage) return;
  storage.setItem(AUTH_TOKEN_KEY, token);
  storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
  window.sessionStorage.removeItem(AUTH_USER_KEY);
}

export function hasAuthToken() {
  return Boolean(getAnyToken());
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw =
    window.localStorage.getItem(AUTH_USER_KEY) ||
    window.sessionStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function updateStoredUser(user) {
  updateSessionValue(AUTH_USER_KEY, JSON.stringify(user));
}

export async function signup({ fullName, email, password, remember }) {
  const payload = await request('/auth/signup', {
    method: 'POST',
    body: {
      full_name: fullName,
      email,
      password,
    },
  });

  saveAuthSession(payload.access_token, payload.user, remember);
  return payload.user;
}

export async function login({ email, password, remember }) {
  const payload = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  saveAuthSession(payload.access_token, payload.user, remember);
  return payload.user;
}

export async function getCurrentUser() {
  const token = getAnyToken();
  if (!token) return null;
  const payload = await request('/auth/me', { token });
  if (payload?.user) {
    updateStoredUser(payload.user);
  }
  return payload.user;
}

export async function updateProfile({ fullName, email, avatarUrl }) {
  const token = getAnyToken();
  if (!token) {
    throw new Error('You must be logged in');
  }

  const payload = await request('/auth/profile', {
    method: 'PUT',
    token,
    body: {
      full_name: fullName,
      email,
      avatar_url: avatarUrl,
    },
  });

  if (payload?.access_token) {
    updateSessionValue(AUTH_TOKEN_KEY, payload.access_token);
  }
  if (payload?.user) {
    updateStoredUser(payload.user);
  }

  return payload.user;
}

export async function uploadProfileImageToCloudinary(file) {
  if (!file) {
    throw new Error('Please select an image first.');
  }

  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed.');
  }

  const token = getAnyToken();
  if (!token) {
    throw new Error('You must be logged in');
  }

  const body = new FormData();
  body.append('file', file);

  const response = await fetch(`${API_BASE}/auth/profile/avatar-upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.secure_url) {
    throw new Error(
      parseErrorMessage(payload, 'Failed to upload image to Cloudinary.'),
    );
  }

  return {
    secureUrl: payload.secure_url,
    bytes: Number(payload.bytes || file.size || 0),
    publicId: payload.public_id,
  };
}

export async function updatePassword({ currentPassword, newPassword }) {
  const token = getAnyToken();
  if (!token) {
    throw new Error('You must be logged in');
  }

  await request('/auth/password', {
    method: 'PUT',
    token,
    body: {
      current_password: currentPassword,
      new_password: newPassword,
    },
  });
}
