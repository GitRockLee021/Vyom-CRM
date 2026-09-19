import { test, expect } from '@playwright/test';
import { api, registerTenant, gotoAuthed } from './helpers.js';
import { createErrorHunter } from './error-hunter.js';

// ---------------------------------------------------------------------------
// ERROR SWEEP — the "find every error in the whole app" test.
//
// How to run (same environment as the other E2E specs):
//   API dev server  ->  port 5001      (npm run dev:server)
//   Vite dev server ->  port 5174      (npm run dev:client)
//   then:            npx playwright test e2e/error-sweep.spec.js
//   or the npm alias: npm run test:sweep
//
// What it does
//   1. Registers a throwaway tenant and seeds one client, invoice, payment and
//      task through the real API, so list/detail/edit pages have data to render.
//   2. Opens EVERY route (17 authenticated screens + the public pages) as that
//      tenant's admin.
//   3. On every screen it nets uncaught JS exceptions, console errors and
//      warnings, failed/blocked network requests, and HTTP 4xx/5xx responses.
//   4. Fails with a report of every distinct error and the URL(s) it appeared on.
//      That report is the deliverable — read the [type] lines, open the listed
//      URL ("seen on:") to reproduce, or hand the whole output to your AI
//      assistant for diagnosis and a fix list.
//   5. Known-beneign noise (favicon 404, ERR_ABORTED on navigation) is tallied
//      as info, not failure. Tune DEFAULT_IGNORE in error-hunter.js once those
//      are genuinely fixed and you want them reported as errors.
//
// NOTES
//   * Runs against a FRESH tenant, so it is independent of any real data.
//   * No content assertions — this tests "no errors", not "features work".
//     Feature correctness is covered by the other *.spec.js files.
//   * Adding a new page to the app? Add its route to AUTHED_ROUTES below.
// ---------------------------------------------------------------------------

const AUTHED_ROUTES = [
  '/',
  '/clients',
  '/clients/new',
  '/clients/new/quick',
  '/clients/{clientId}/edit',
  '/invoices',
  '/invoices/new',
  '/invoices/{invoiceId}/edit',
  '/invoice/{invoiceId}',
  '/payments',
  '/payments/new',
  '/payments/{paymentId}/edit',
  '/invoices/{invoiceId}/pay',
  '/tasks',
  '/settings',
  '/settings/roles',
  '/settings/team',
];

const PUBLIC_ROUTES = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/invite'];

test.describe('Error sweep', () => {
  test('1. Every authenticated page loads without runtime or API errors', async ({ page }) => {
    const hunt = createErrorHunter(page);

    // --- Provision a throwaway tenant + one of everything (best-effort) ---
    const tenant = await registerTenant('sweep');
    const client = await api('/api/clients', {
      method: 'POST',
      token: tenant.admin.token,
      body: {
        name: 'Error Sweep Client',
        client_type: 'business',
        service_ids: tenant.services[0]?.id ? [tenant.services[0].id] : [],
      },
    });
    const invoice = await api('/api/invoices', {
      method: 'POST',
      token: tenant.admin.token,
      body: { client_id: client.id, amount: 12000, gst_rate: 18 },
    });
    let paymentId = null;
    try {
      const payment = await api(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        token: tenant.admin.token,
        body: { amount: 12000, method: 'bank_transfer' },
      });
      paymentId = payment?.payment?.id || null;
    } catch {
      // payment is optional for the sweep
    }
    try {
      await api('/api/tasks', {
        method: 'POST',
        token: tenant.admin.token,
        body: { title: 'Sweep compliance task', client_id: client.id, status: 'todo' },
      });
    } catch {
      // task is optional for the sweep
    }

    // --- Walk every authenticated route ---
    const routes = [];
    for (const tpl of AUTHED_ROUTES) {
      if (tpl.includes('{paymentId}') && !paymentId) continue;
      routes.push(
        tpl
          .replace('{clientId}', client.id)
          .replace(/{invoiceId}/g, invoice.id)
          .replace('{paymentId}', paymentId || '00000000-0000-4000-8000-000000000000')
      );
    }

    await seedAndOpen(page, tenant, routes[0]);
    for (const url of routes.slice(1)) {
      await page.goto(url);
      await settle(page);
    }
    await settle(page);

    const report = hunt.report();
    // eslint-disable-next-line no-console
    console.log('[sweep] ignored (known-beneign):', hunt.infos.length);
    expect(hunt.grouped(), `ERROR SWEEP FAILED — ${report}`).toEqual([]);
  });

  test('2. Public pages (login, signup, forgot/reset password, invite) load cleanly', async ({ page }) => {
    const hunt = createErrorHunter(page);
    for (const route of PUBLIC_ROUTES) {
      await page.goto(route);
      await settle(page);
    }
    await settle(page);
    expect(hunt.grouped(), `ERROR SWEEP FAILED — ${hunt.report()}`).toEqual([]);
  });
});

// Seed auth storage, open the first route, then give the app time to settle
// after each navigation so lazy chunks + background fetches finish and fire
// their errors into the hunter while we are watching.
async function seedAndOpen(page, tenant, path) {
  await gotoAuthed(page, tenant.admin.token, tenant.admin.user, path);
  await settle(page);
}

// networkidle can stall on a never-idle client (polls, fonts); we give it a
// generous window and always fall back to a fixed settle wait.
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
}