import { test, expect } from '@playwright/test';
import { registerTenant, api, gotoAuthed, stamp } from './helpers.js';

// ---------------------------------------------------------------------------
// Core module 3 — Clients
// ---------------------------------------------------------------------------

const TYPES = [
  ['individual', 'Individual'],
  ['partnership', 'Partnership'],
  ['private_limited', 'Private Limited'],
  ['llp', 'LLP'],
  ['proprietor', 'Proprietor'],
  ['others', 'Others'],
];

async function createClient(token, serviceId, overrides = {}) {
  const base = { client_type: 'individual', phone: '9876543210', status: 'active', service_ids: [serviceId] };
  return api('/api/clients', {
    method: 'POST',
    token,
    body: { name: `Client ${stamp()}`, ...base, ...overrides },
  });
}

async function selectService(page, text) {
  await page.locator('[role="checkbox"]').filter({ hasText: text }).first().click();
}

function rowFor(page, text) {
  return page.locator('tbody tr').filter({ hasText: text }).first();
}

test.describe('3. Clients', () => {
  let tenant;

  test.beforeAll(async () => {
    tenant = await registerTenant('clients');
  });

  test('3.1 Table loads with expected columns', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients');
    await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toBeVisible({ timeout: 30000 });
    for (const col of ['Client Name', 'Assessee Type', 'Email', 'Phone', 'Status', 'Actions']) {
      await expect(page.locator('th', { hasText: col }).first()).toBeVisible();
    }
  });

  test('3.1 Empty state message shown when no clients exist', async ({ page }) => {
    const empty = await registerTenant('empty');
    await gotoAuthed(page, empty.admin.token, empty.admin.user, '/clients');
    await expect(page.getByText(/No clients yet/i)).toBeVisible({ timeout: 30000 });
  });

  test('3.2 Valid add — client is created via the form (no toast observed)', async ({ page }) => {
    const name = `UI Client ${stamp()}`;
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page).toHaveURL(/\/clients\/new$/);
    await page.fill('#legalName', name);
    await page.fill('#phone', '9876543210');
    await selectService(page, 'Bookkeeping');
    await page.getByRole('button', { name: 'Create Client' }).click();
    await expect(page).toHaveURL(/\/clients$/, { timeout: 30000 });
    await expect(page.getByText(name)).toBeVisible();
  });

  test('3.2 Missing name is blocked by validation', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients/new');
    await page.fill('#phone', '9876543210');
    await selectService(page, 'Bookkeeping');
    await page.getByRole('button', { name: 'Create Client' }).click();
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toBe('/clients/new');
  });

  test('3.2 Invalid email is blocked by validation', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients/new');
    await page.fill('#legalName', `BadEmail ${stamp()}`);
    await page.fill('#phone', '9876543210');
    await page.fill('#email', 'abc@');
    await selectService(page, 'Bookkeeping');
    await page.getByRole('button', { name: 'Create Client' }).click();
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toBe('/clients/new');
  });

  test('3.2 All assessee types save correctly', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients/new');
    await expect(page.locator('#clientType')).toBeVisible({ timeout: 30000 });
    const options = await page.locator('#clientType option').allInnerTexts();
    for (const [, label] of TYPES) expect(options.join('|')).toContain(label);

    for (const [value] of TYPES) {
      const c = await createClient(tenant.admin.token, tenant.services[0].id, { name: `Type ${value}`, client_type: value });
      expect(c.client_type).toBe(value);
    }
  });

  test('3.3 Edit client — change name', async ({ page }) => {
    const c = await createClient(tenant.admin.token, tenant.services[0].id, { name: 'Edit Me Name' });
    const newName = `Renamed ${stamp()}`;
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients');
    const row = rowFor(page, 'Edit Me Name');
    await row.hover();
    await row.locator('button[title="Edit"]').click();
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+\/edit$/);
    await page.fill('#legalName', newName);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page).toHaveURL(/\/clients$/, { timeout: 30000 });
    const updated = await api(`/api/clients/${c.id}`, { token: tenant.admin.token });
    expect(updated.name).toBe(newName);
  });

  test('3.3 Edit client — change email and status', async ({ page }) => {
    const c = await createClient(tenant.admin.token, tenant.services[0].id, { name: 'Edit Email Status', email: 'old@example.com', status: 'active' });
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, `/clients/${c.id}/edit`);
    await page.fill('#email', 'new@example.com');
    await page.selectOption('#status', 'inactive');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page).toHaveURL(/\/clients$/, { timeout: 30000 });
    const updated = await api(`/api/clients/${c.id}`, { token: tenant.admin.token });
    expect(updated.email).toBe('new@example.com');
    expect(updated.status).toBe('inactive');
  });

  test('3.3 Cancel edit leaves client unchanged', async ({ page }) => {
    const c = await createClient(tenant.admin.token, tenant.services[0].id, { name: 'Cancel Me' });
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, `/clients/${c.id}/edit`);
    await page.fill('#legalName', 'Should Not Persist');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/clients$/, { timeout: 30000 });
    const updated = await api(`/api/clients/${c.id}`, { token: tenant.admin.token });
    expect(updated.name).toBe('Cancel Me');
  });

  test('3.4 Delete client after confirmation', async ({ page }) => {
    const c = await createClient(tenant.admin.token, tenant.services[0].id, { name: 'Delete Me' });
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients');
    const row = rowFor(page, 'Delete Me');
    await row.hover();
    await row.locator('button[title="Delete"]').click();
    await expect(page.getByText('Delete Client?')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Delete Me')).toHaveCount(0, { timeout: 30000 });
    await expect(api(`/api/clients/${c.id}`, { token: tenant.admin.token })).rejects.toThrow();
  });

  test('3.4 Cancel delete keeps the client', async ({ page }) => {
    const c = await createClient(tenant.admin.token, tenant.services[0].id, { name: 'Keep Me' });
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients');
    const row = rowFor(page, 'Keep Me');
    await row.hover();
    await row.locator('button[title="Delete"]').click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForTimeout(500);
    const kept = await api(`/api/clients/${c.id}`, { token: tenant.admin.token });
    expect(kept.id).toBe(c.id);
  });

  test('3.5 Search by name / email / assessee type', async ({ page }) => {
    await createClient(tenant.admin.token, tenant.services[0].id, { name: 'Aarav Sharma', email: 'contact@greentech.com', client_type: 'private_limited' });
    await createClient(tenant.admin.token, tenant.services[0].id, { name: 'Rohan Mehta', email: 'rohan@acme.com', client_type: 'individual' });
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients');

    const search = page.getByPlaceholder('Search by name, email, or assessee type');
    await search.fill('Aarav');
    await expect(page.getByText('Aarav Sharma')).toBeVisible();
    await expect(page.getByText('Rohan Mehta')).toHaveCount(0);

    await search.fill('contact@greentech');
    await expect(page.getByText('Aarav Sharma')).toBeVisible();
    await expect(page.getByText('Rohan Mehta')).toHaveCount(0);

    await search.fill('Private');
    await expect(page.getByText('Aarav Sharma')).toBeVisible();
    await expect(page.getByText('Rohan Mehta')).toHaveCount(0);
  });

  test('3.5 Status filter All / Active / Inactive', async ({ page }) => {
    await createClient(tenant.admin.token, tenant.services[0].id, { name: 'Active Person', status: 'active' });
    await createClient(tenant.admin.token, tenant.services[0].id, { name: 'Inactive Person', status: 'inactive' });
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients');
    const filter = page.locator('select').first();

    await filter.selectOption('active');
    await expect(page.locator('tbody')).toContainText('Active Person');
    await expect(page.locator('tbody')).not.toContainText('Inactive Person');

    await filter.selectOption('inactive');
    await expect(page.locator('tbody')).toContainText('Inactive Person');
    await expect(page.locator('tbody')).not.toContainText('Active Person');

    await filter.selectOption('');
    await expect(page.locator('tbody')).toContainText('Active Person');
    await expect(page.locator('tbody')).toContainText('Inactive Person');
  });

  test('3.6 Pagination across pages', async ({ page }) => {
    for (let i = 1; i <= 12; i += 1) {
      await createClient(tenant.admin.token, tenant.services[0].id, { name: `Paged Client ${String(i).padStart(2, '0')}` });
    }
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients');
    await expect(page.getByText('Showing 1 to 5 of ')).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Showing 6 to 10 of ')).toBeVisible();

    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page.getByText('Showing 1 to 5 of ')).toBeVisible();

    await page.getByRole('button', { name: '3', exact: true }).click();
    await expect(page.getByText(/Showing 11 to \d+ of /)).toBeVisible();
  });

  test('3.7 Export CSV downloads clients.csv', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('clients.csv');
  });

  test('3.7 Import CSV adds clients but without any service (latent bug)', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients');
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByText('Import Clients')).toBeVisible();
    const importName = `Import Client ${stamp()}`;
    await page.setInputFiles('input[type=file]', {
      name: 'clients.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`Name,Assessee Type,Email\n${importName},Individual,import@example.com\n`),
    });
    await expect(page.getByText(/Imported 1 client/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(importName)).toBeVisible();

    const clients = await api('/api/clients', { token: tenant.admin.token });
    const imported = clients.find((c) => c.name === importName);
    expect(imported).toBeTruthy();
    expect(imported.services || []).toHaveLength(0);
  });
});
