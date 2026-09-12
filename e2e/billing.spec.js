import { test, expect } from '@playwright/test';
import { registerTenant, api, gotoAuthed, stamp } from './helpers.js';

// ---------------------------------------------------------------------------
// Core module 4 — Billing / Invoices
// ---------------------------------------------------------------------------

async function createClient(token, serviceId, name) {
  return api('/api/clients', {
    method: 'POST',
    token,
    body: { name, client_type: 'individual', service_ids: [serviceId] },
  });
}

async function createInvoice(token, clientId, overrides = {}) {
  return api('/api/invoices', {
    method: 'POST',
    token,
    body: { client_id: clientId, amount: 1000, gst_rate: 18, status: 'sent', issued_date: '2026-09-01', due_date: '2026-12-31', ...overrides },
  });
}

test.describe('4. Billing / Invoices', () => {
  let tenant;
  let client;

  test.beforeAll(async () => {
    tenant = await registerTenant('billing');
    client = await createClient(tenant.admin.token, tenant.services[0].id, `Bill Client ${stamp()}`);
  });

  test('4.1 Table loads with expected columns', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/invoices');
    await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible({ timeout: 30000 });
    for (const col of ['Invoice #', 'Client Name', 'Issue Date', 'Due Date', 'Status', 'Actions']) {
      await expect(page.locator('th', { hasText: col }).first()).toBeVisible();
    }
  });

  test('4.1 Metric cards visible', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/invoices');
    for (const m of ['Total Revenue', 'Total Invoices', 'Paid', 'Unpaid']) {
      await expect(page.locator('span.uppercase').filter({ hasText: new RegExp(`^${m}$`) })).toBeVisible({ timeout: 30000 });
    }
  });

  test('4.2 Valid create — auto-calc, tax calc and invoice number', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/invoices');
    await page.getByRole('button', { name: 'Create Invoice' }).click();
    await expect(page).toHaveURL(/\/invoices\/new$/);

    await page.getByPlaceholder('Search client name...').fill(client.name);
    await page.locator('[role="option"]').filter({ hasText: client.name }).first().click();

    await page.getByPlaceholder('Service Name').fill('Consulting');
    const qty = page.locator('table input[type="number"]').nth(0);
    const rate = page.locator('table input[type="number"]').nth(1);
    await qty.fill('2');
    await rate.fill('500');
    // Amount = 1000, GST 18% = 180, total = 1180
    await expect(page.getByText('1,180.00')).toBeVisible();

    const invNumberInput = page.locator('input[readonly]').first();
    await expect(invNumberInput).not.toHaveValue('', { timeout: 30000 });
    const invNumber = await invNumberInput.inputValue();
    expect(invNumber).toMatch(/^[A-Z]+-\d{4}-\d{4}$/);

    await page.getByRole('button', { name: /Save$/ }).click();
    await expect(page).toHaveURL(/\/invoices$/, { timeout: 30000 });
    await expect(page.locator('tbody').getByText(client.name)).toBeVisible();

    const invoices = await api('/api/invoices', { token: tenant.admin.token });
    const created = invoices.find((i) => i.invoice_number === invNumber);
    expect(created).toBeTruthy();
    expect(Number(created.amount)).toBe(1000);
    expect(Number(created.gst_rate)).toBe(18);
  });

  test('4.2 Missing client shows validation error', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/invoices/new');
    await page.getByPlaceholder('Service Name').fill('Consulting');
    await page.getByRole('button', { name: /Save$/ }).click();
    await expect(page.getByText(/Please select a client to bill/)).toBeVisible({ timeout: 20000 });
  });

  test('4.2 Missing line items shows validation error', async ({ page }) => {
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/invoices/new');
    await page.getByPlaceholder('Search client name...').fill(client.name);
    await page.locator('[role="option"]').filter({ hasText: client.name }).first().click();
    await page.getByRole('button', { name: /Save$/ }).click();
    await expect(page.getByText(/Add at least one line item/)).toBeVisible({ timeout: 20000 });
  });

  test('4.3 Edit invoice — change amount', async ({ page }) => {
    const inv = await createInvoice(tenant.admin.token, client.id, {
      notes: JSON.stringify({ items: [{ service: 'Consulting', description: '', qty: 1, rate: 1000, tax: 18 }] }),
    });
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, `/invoices/${inv.id}/edit`);
    await expect(page.getByRole('heading', { name: client.name })).toBeVisible({ timeout: 30000 });
    await page.locator('table input[type="number"]').nth(1).fill('2000');
    await expect(page.getByText('2,360.00')).toBeVisible();
    await page.getByRole('button', { name: /Update$/ }).click();
    await expect(page).toHaveURL(/\/invoices$/, { timeout: 30000 });
    const updated = await api(`/api/invoices/${inv.id}`, { token: tenant.admin.token });
    expect(Number(updated.amount)).toBe(2000);
  });

  test('4.3 Edit invoice — status changes via the status dropdown', async ({ page }) => {
    const inv = await createInvoice(tenant.admin.token, client.id, {
      status: 'draft',
      notes: JSON.stringify({ items: [{ service: 'Consulting', description: '', qty: 1, rate: 1000, tax: 18 }] }),
    });
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, `/invoices/${inv.id}/edit`);
    await expect(page.getByRole('heading', { name: client.name })).toBeVisible({ timeout: 30000 });
    const statusSelect = page.locator('select#invoice-status');
    await expect(statusSelect).toHaveValue('draft', { timeout: 30000 });
    await statusSelect.selectOption('sent');
    await page.getByRole('button', { name: /Update$/ }).click();
    await expect(page).toHaveURL(/\/invoices$/, { timeout: 30000 });
    const updated = await api(`/api/invoices/${inv.id}`, { token: tenant.admin.token });
    expect(updated.status).toBe('sent');
  });

  test('4.3 Edit invoice — add line item recalculates total', async ({ page }) => {
    const inv = await createInvoice(tenant.admin.token, client.id, {
      notes: JSON.stringify({ items: [{ service: 'Consulting', description: '', qty: 1, rate: 1000, tax: 18 }] }),
    });
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, `/invoices/${inv.id}/edit`);
    await expect(page.getByText('1,180.00')).toBeVisible();
    await page.getByRole('button', { name: 'ADD LINE ITEM' }).click();
    await page.locator('table input[type="number"]').nth(2).fill('2');
    await page.locator('table input[type="number"]').nth(3).fill('500');
    await expect(page.getByText('2,360.00')).toBeVisible();
  });

  test('4.4 Delete invoice', async ({ page }) => {
    const inv = await createInvoice(tenant.admin.token, client.id);
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/invoices');
    const row = page.locator('tbody tr').filter({ hasText: inv.invoice_number }).first();
    await row.locator('button[title="Delete"]').click();
    await expect(page.getByText('Delete Invoice?')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(inv.invoice_number)).toHaveCount(0, { timeout: 30000 });
  });

  test('4.5 Invoice view opens in new tab and shows content', async ({ page }) => {
    const inv = await createInvoice(tenant.admin.token, client.id, {
      notes: JSON.stringify({ items: [{ service: 'Consulting', description: 'Advisory', qty: 1, rate: 1000, tax: 18 }] }),
    });
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/invoices');
    const [newPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.locator(`a[href="/invoice/${inv.id}"]`).first().click(),
    ]);
    await newPage.waitForURL(/\/invoice\//);
    await expect(newPage.getByText(client.name)).toBeVisible({ timeout: 30000 });
    await expect(newPage.getByText('Consulting', { exact: true })).toBeVisible();
    await expect(newPage.getByText(/GST/i).first()).toBeVisible();
    await expect(newPage.getByRole('button', { name: 'Download PDF' })).toBeVisible();
  });

  test('4.5 Breadcrumb / back navigation returns to Billing', async ({ page }) => {
    const inv = await createInvoice(tenant.admin.token, client.id);
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, `/invoice/${inv.id}`);
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb.getByText('Billing', { exact: true })).toBeVisible({ timeout: 30000 });
    await breadcrumb.getByText('Billing', { exact: true }).click();
    await expect(page).toHaveURL(/\/invoices$/, { timeout: 30000 });
  });

  test('4.6 Download PDF triggers a download', async ({ page }) => {
    const inv = await createInvoice(tenant.admin.token, client.id, {
      notes: JSON.stringify({ items: [{ service: 'Consulting', description: '', qty: 1, rate: 1000, tax: 18 }] }),
    });
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, `/invoice/${inv.id}`);
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible({ timeout: 30000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.getByRole('button', { name: 'Download PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test('4.7 Record payment marks invoice paid and updates Revenue MTD', async ({ page }) => {
    const before = await api('/api/dashboard/summary', { token: tenant.admin.token });
    const inv = await createInvoice(tenant.admin.token, client.id);
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, `/invoices/${inv.id}/pay`);
    await expect(page.getByText('Balance Due')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: 'Record Payment' }).click();
    await expect(page).toHaveURL(/\/invoice\//, { timeout: 30000 });
    const updated = await api(`/api/invoices/${inv.id}`, { token: tenant.admin.token });
    expect(updated.status).toBe('paid');
    const after = await api('/api/dashboard/summary', { token: tenant.admin.token });
    expect(after.revenueMtd).toBeGreaterThan(before.revenueMtd);
  });

  test('4.8 "Send Reminder" button is absent (WhatsApp action instead)', async ({ page }) => {
    const inv = await createInvoice(tenant.admin.token, client.id);
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, '/invoices');
    await expect(page.getByRole('button', { name: /Send Reminder/i })).toHaveCount(0);
    await gotoAuthed(page, tenant.admin.token, tenant.admin.user, `/invoice/${inv.id}`);
    await expect(page.getByRole('button', { name: /Send Reminder/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /WhatsApp/i })).toBeVisible();
  });
});
