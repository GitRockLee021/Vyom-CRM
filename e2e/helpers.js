// Shared helpers for the core-module E2E specs.

export const API = 'http://localhost:5000';
export const PW = 'QaE2ePass123!';

export async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`${method} ${pathname} -> ${res.status}: ${JSON.stringify(data)}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export async function registerTenant(prefix = 'core') {
  const email = `e2e-${prefix}-${stamp()}@example.com`;
  const admin = await api('/api/auth/register', {
    method: 'POST',
    body: { full_name: `${prefix} Admin`, email, password: PW, company_name: `${prefix} Firm` },
  });
  const services = await api('/api/services', { token: admin.token });
  return {
    admin: { email, password: PW, token: admin.token, user: admin.user },
    services,
  };
}

export async function loginApi(email, password = PW) {
  return api('/api/auth/login', { method: 'POST', body: { email, password } });
}

// Authenticate a fresh page context by seeding localStorage before load.
export async function seedAuth(page, token, user) {
  await page.addInitScript(([t, u]) => {
    window.localStorage.setItem('vyom_token', t);
    window.localStorage.setItem('vyom_user', JSON.stringify(u));
  }, [token, user]);
}

export async function gotoAuthed(page, token, user, path = '/') {
  await seedAuth(page, token, user);
  await page.goto(path);
}

// Read the KPI card value next to a label on the dashboard.
export async function kpiValue(page, label) {
  const card = page.locator('div.rounded-xl').filter({ hasText: label }).first();
  return (await card.locator('h3').first().innerText()).trim();
}
