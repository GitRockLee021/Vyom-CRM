const TOKEN_KEY = 'vyom_token';

export function authHeaders(extra = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}