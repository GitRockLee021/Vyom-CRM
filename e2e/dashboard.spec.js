import { test, expect } from '@playwright/test';
import { registerTenant, api, gotoAuthed, kpiValue } from './helpers.js';

// ---------------------------------------------------------------------------
// Core module 2 — Dashboard
// ---------------------------------------------------------------------------

test.describe('2. Dashboard', () => {
  let tenant;

  test.beforeAll(async () => {
    tenant = await registerTenant('dash');
  });

  test('2. Metrics load (Total Clients, Revenue MTD, Pending Invoices)', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/');
    await expect(page.getByText('Total Clients', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Revenue MTD', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending Invoices', { exact: true })).toBeVisible();
    await expect(page.getByText('Overdue Invoices', { exact: true })).toBeVisible();
  });

  test('2. Real data — Total Clients increments after creating a client', async ({ page }) => {
    const before = await api('/api/dashboard/summary', { token: tenant.admin.token });
    const client = await api('/api/clients', {
      method: 'POST',
      token: tenant.admin.token,
      body: { name: 'Dash Client', client_type: 'individual', service_ids: [tenant.services[0].id] },
    });
    expect(client.id).toBeTruthy();
    const after = await api('/api/dashboard/summary', { token: tenant.admin.token });
    expect(after.totalClients).toBe(before.totalClients + 1);

    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/');
    await expect(page.getByText('Total Clients', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('div.rounded-xl').filter({ hasText: 'Total Clients' }).first().locator('h3')).toHaveText(String(after.totalClients));
  });

  test('2. Quick action "+ Add Client" navigates to the add form', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/');
    await page.getByRole('button', { name: 'Add Client' }).click();
    await expect(page).toHaveURL(/\/clients\/new$/, { timeout: 30000 });
  });

  test('2. Quick action "+ Create Invoice" navigates to the invoice form', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/');
    await page.getByRole('button', { name: 'Create Invoice' }).click();
    await expect(page).toHaveURL(/\/invoices\/new$/, { timeout: 30000 });
  });

  test('2. Overdue alert banner is not present (only the KPI card)', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/');
    // The overdue count is rendered as a KPI card; there is no dedicated alert banner.
    await expect(page.getByText('Overdue Invoices', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Overdue Invoices: \d+/)).toHaveCount(0);
  });

  test('2. API status badge is absent', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/');
    await expect(page.getByText(/API online/i)).toHaveCount(0);
    await expect(page.getByText(/database connected/i)).toHaveCount(0);
  });
});
