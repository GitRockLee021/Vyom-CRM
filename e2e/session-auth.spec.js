import { test, expect } from '@playwright/test';
import { registerTenant, gotoAuthed, kpiValue } from './helpers.js';

// ---------------------------------------------------------------------------
// Regression: token stored in sessionStorage ("Remember me" unchecked, the
// default login state) must still be sent as an Authorization header.
// Previously authHeaders() only read localStorage, so every data request
// returned 401 "Not authenticated" while the user still appeared logged in.
// ---------------------------------------------------------------------------

test.describe('auth: sessionStorage token (Remember me off)', () => {
  let tenant;

  test.beforeAll(async () => {
    tenant = await registerTenant('sess');
  });

  test('dashboard loads data with a sessionStorage-only token', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/', { storage: 'sessionStorage' });
    await expect(page.getByText('Total Clients', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Revenue MTD', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending Invoices', { exact: true })).toBeVisible();
    await expect(page.getByText(/Could not load dashboard data/)).toHaveCount(0);
  });

  test('clients list loads with a sessionStorage-only token', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/clients', { storage: 'sessionStorage' });
    await expect(page.getByText('Clients', { exact: true }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Not authenticated')).toHaveCount(0);
  });
});