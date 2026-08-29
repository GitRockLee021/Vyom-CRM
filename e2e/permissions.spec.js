import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// E2E verification of the permission-aware UI.
// A fresh firm + admin/consultant/accountant are provisioned via the API first,
// then we sign in through the real login form and assert button visibility per
// role against the client-side `can()` gating.
// ---------------------------------------------------------------------------

const API = 'http://localhost:5000';
const PW = 'QaE2ePass123!';

async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${pathname} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

const stamp = Date.now();
const firm = {
  admin: { email: `e2e-admin-${stamp}@example.com`, pw: PW, fullName: 'E2E Admin' },
  consultant: { email: `e2e-consultant-${stamp}@example.com`, pw: PW, fullName: 'E2E Consultant' },
  accountant: { email: `e2e-accountant-${stamp}@example.com`, pw: PW, fullName: 'E2E Accountant' },
};

let clientId;
let invoiceId;

async function provision() {
  const admin = await api('/api/auth/register', {
    method: 'POST',
    body: {
      full_name: firm.admin.fullName,
      email: firm.admin.email,
      password: firm.admin.pw,
      company_name: 'E2E Demo Firm',
    },
  });

  for (const [key, user] of [
    ['consultant', firm.consultant],
    ['accountant', firm.accountant],
  ]) {
    const invite = await api('/api/team/invites', {
      method: 'POST',
      token: admin.token,
      body: { email: user.email, role: key },
    });
    const token = new URL(invite.devInviteUrl).searchParams.get('token');
    await api('/api/auth/accept-invite', {
      method: 'POST',
      body: { token, full_name: user.fullName, email: user.email, password: user.pw },
    });
  }

  const client = await api('/api/clients', {
    method: 'POST',
    token: admin.token,
    body: { name: 'E2E Client', client_type: 'business' },
  });
  const invoice = await api('/api/invoices', {
    method: 'POST',
    token: admin.token,
    body: { client_id: client.id, amount: 1200, gst_rate: 18 },
  });
  clientId = client.id;
  invoiceId = invoice.id;
}

test.beforeAll(async () => {
  await provision();
});

async function login(page, email) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PW);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 15000 }).catch(() => {});
  await expect(page.getByRole('heading', { name: /Welcome back/i })).not.toBeVisible({ timeout: 20000 });
}

const CLIENT_ROW = (page) => page.locator('tbody tr').first();
const rowButton = (page, title) => CLIENT_ROW(page).locator(`button[title="${title}"]`);

test('consultant: create-only client & billing controls, no deletes, no billing edit', async ({ page }) => {
  await login(page, firm.consultant.email);

  // Clients
  await page.goto('/clients');
  await expect(page.getByRole('button', { name: 'Add Client' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
  await expect(rowButton(page, 'Edit')).toBeVisible();
  await expect(rowButton(page, 'Delete')).toHaveCount(0);

  // Billing
  await page.goto('/invoices');
  await expect(page.getByRole('button', { name: 'Create Invoice' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record Payment' })).toBeVisible();
  await expect(CLIENT_ROW(page).locator('button[title="Edit"]')).toHaveCount(0);
  await expect(CLIENT_ROW(page).locator('button[title="Delete"]')).toHaveCount(0);

  // Settings: read-only
  await page.goto('/settings');
  await expect(page.getByText('You have read-only access to settings.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Company Settings' })).toHaveCount(0);
});

test('consultant: direct invoice-edit URL is blocked', async ({ page }) => {
  await login(page, firm.consultant.email);
  await page.goto(`/invoices/${invoiceId}/edit`);
  await expect(page.getByText("You don't have permission to edit invoices.")).toBeVisible();
});

test('accountant: view-only clients, billing full (no invoice delete), read-only settings', async ({ page }) => {
  await login(page, firm.accountant.email);

  // Clients: no mutations at all
  await page.goto('/clients');
  await expect(page.getByRole('button', { name: 'Add Client' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import' })).toHaveCount(0);
  await expect(rowButton(page, 'Edit')).toHaveCount(0);
  await expect(rowButton(page, 'Delete')).toHaveCount(0);

  // Billing: Create + Record + Edit allowed, Delete hidden
  await page.goto('/invoices');
  await expect(page.getByRole('button', { name: 'Create Invoice' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record Payment' })).toBeVisible();
  await expect(CLIENT_ROW(page).locator('button[title="Edit"]')).toBeVisible();
  await expect(CLIENT_ROW(page).locator('button[title="Delete"]')).toHaveCount(0);

  // Settings read-only
  await page.goto('/settings');
  await expect(page.getByText('You have read-only access to settings.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Company Settings' })).toHaveCount(0);
});

test('accountant: direct client-edit URL is blocked', async ({ page }) => {
  await login(page, firm.accountant.email);
  await page.goto(`/clients/${clientId}/edit`);
  await expect(page.getByText("You don't have permission to edit clients.")).toBeVisible();
});

test('admin: full visibility across clients, billing and settings', async ({ page }) => {
  await login(page, firm.admin.email);

  await page.goto('/invoices');
  await expect(page.getByRole('button', { name: 'Create Invoice' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record Payment' })).toBeVisible();
  await expect(CLIENT_ROW(page).locator('button[title="Edit"]')).toBeVisible();

  await page.goto('/clients');
  await expect(page.getByRole('button', { name: 'Add Client' })).toBeVisible();
  await expect(rowButton(page, 'Edit')).toBeVisible();
  await expect(rowButton(page, 'Delete')).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Save Company Settings' })).toBeVisible();
  await expect(page.getByText('You have read-only access to settings.')).toHaveCount(0);
});