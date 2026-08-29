import { authHeaders } from '../utils/authHeader.js';

const BASE_URL = '/api';

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: authHeaders({
      'Content-Type': 'application/json',
      ...headers,
    }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export function get(path) {
  return request(path);
}

export function post(path, body) {
  return request(path, { method: 'POST', body });
}

export function put(path, body) {
  return request(path, { method: 'PUT', body });
}

export function del(path) {
  return request(path, { method: 'DELETE' });
}
