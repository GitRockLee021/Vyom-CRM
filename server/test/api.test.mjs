import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const serverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHealth(timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  throw new Error(`test server did not boot on :${PORT}`);
}

let server;
let bootLog = '';

before(async () => {
  server = spawn(process.execPath, ['--env-file-if-exists=.env', 'src/index.js'], {
    cwd: serverDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => { bootLog += d.toString(); });
  server.stderr.on('data', (d) => { bootLog += d.toString(); });
  server.on('exit', () => { server = undefined; });
  await waitForHealth();
});

after(() => {
  if (server) server.kill();
});

async function api(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);

async function register(email, fullName, companyName) {
  const { status, data } = await api('/api/auth/register', {
    method: 'POST',
    body: { full_name: fullName, email, password: 'SmokePass123!', company_name: companyName },
  });
  assert.equal(status, 201, `register failed: ${JSON.stringify(data)}`);
  return data;
}

async function inviteAccept(adminToken, email, role, fullName) {
  const invite = await api('/api/team/invites', {
    method: 'POST',
    token: adminToken,
    body: { email, role },
  });
  assert.equal(invite.status, 201, `invite failed: ${JSON.stringify(invite.data)}`);
  const token = new URL(invite.data.devInviteUrl).searchParams.get('token');
  const accepted = await api('/api/auth/accept-invite', {
    method: 'POST',
    body: { token, full_name: fullName, email, password: 'SmokePass456!' },
  });
  assert.equal(accepted.status, 201, `accept failed: ${JSON.stringify(accepted.data)}`);
  return accepted.data;
}

test('health endpoint', async () => {
  const res = await api('/api/health');
  assert.equal(res.status, 200);
});

test('invite flow + multi-tenant isolation', async () => {
  const a = await register(`t-a-${stamp}@example.com`, 'Tenant A', 'A Firm');
  const b = await register(`t-b-${stamp}@example.com`, 'Tenant B', 'B Firm');

  const consultant = await inviteAccept(a.token, `ta-consultant-${stamp}@example.com`, 'consultant', 'A Consultant');

  const client = await api('/api/clients', {
    method: 'POST',
    token: a.token,
    body: { name: 'Tenant A Client', client_type: 'business' },
  });
  assert.equal(client.status, 201);

  // Invited consultant sees tenant A data.
  const list = await api('/api/clients', { token: consultant.token });
  assert.equal(list.status, 200);
  assert.ok(list.data.some((c) => c.id === client.data.id), 'invited member should see tenant A clients');

  // Tenant B admin must NOT see/splice tenant A data.
  const cross = await api(`/api/clients/${client.data.id}`, { token: b.token });
  assert.equal(cross.status, 404);

  // Tenant B cannot invite users into tenant A's team, nor delete its records.
  const crossDelete = await api(`/api/clients/${client.data.id}`, { method: 'DELETE', token: b.token });
  assert.equal(crossDelete.status, 404);

  // Non-admin cannot invite.
  const nonAdminInvite = await api('/api/team/invites', {
    method: 'POST',
    token: consultant.token,
    body: { email: `no-${stamp}@example.com`, role: 'consultant' },
  });
  assert.equal(nonAdminInvite.status, 403);
});

test('forgot + reset password (dev mailer)', async () => {
  const email = `reset-${stamp}@example.com`;
  const admin = await register(email, 'Reset Admin', 'Reset Firm');
  const forgot = await api('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
  assert.equal(forgot.status, 200);
  assert.ok(forgot.data.devResetLink, 'dev mode should echo a reset link');

  const token = new URL(forgot.data.devResetLink).searchParams.get('token');
  const reset = await api('/api/auth/reset-password', {
    method: 'POST',
    body: { token, new_password: 'NewPass789!' },
  });
  assert.equal(reset.status, 200);

  const oldLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'SmokePass123!' },
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'NewPass789!' },
  });
  assert.equal(newLogin.status, 200);
  assert.ok(newLogin.data.user && typeof newLogin.data.user.permissions === 'object' && newLogin.data.user.permissions !== null, 'login should return permissions');
});

test('role permission matrix', async () => {
  const admin = await register(`pm-${stamp}@example.com`, 'Perm Admin', 'Perm Firm');
  const adminToken = admin.token;

  const consultant = await inviteAccept(adminToken, `pm-c-${stamp}@example.com`, 'consultant', 'Perm Consultant');
  const accountant = await inviteAccept(adminToken, `pm-a-${stamp}@example.com`, 'accountant', 'Perm Accountant');

  assert.ok(admin.user.role_id, 'admin should be linked to a role row');

  const client = await api('/api/clients', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Perm Client', client_type: 'business' },
  });
  const invoice = await api('/api/invoices', {
    method: 'POST',
    token: adminToken,
    body: { client_id: client.data.id, amount: 1000, gst_rate: 18 },
  });

  // Consultant: clients + billing view/create, services/engagements create, no deletes, no billing.edit
  assert.equal((await api('/api/clients', { token: consultant.token })).status, 200);
  assert.equal((await api('/api/clients', { method: 'POST', token: consultant.token, body: { name: 'C Client', client_type: 'individual' } })).status, 201);
  assert.equal((await api(`/api/clients/${client.data.id}`, { method: 'PUT', token: consultant.token, body: { notes: 'x' } })).status, 200);
  assert.equal((await api(`/api/clients/${client.data.id}`, { method: 'DELETE', token: consultant.token })).status, 403);
  assert.equal((await api('/api/invoices', { token: consultant.token })).status, 200);
  assert.equal((await api('/api/invoices', { method: 'POST', token: consultant.token, body: { client_id: client.data.id, amount: 500, gst_rate: 0 } })).status, 201);
  assert.equal((await api(`/api/invoices/${invoice.data.id}`, { method: 'PUT', token: consultant.token, body: { notes: 'nope' } })).status, 403);
  assert.equal((await api(`/api/invoices/${invoice.data.id}`, { method: 'DELETE', token: consultant.token })).status, 403);
  assert.equal((await api('/api/settings', { method: 'PUT', token: consultant.token, body: { company_name: 'Hack' } })).status, 403);

  const svc = await api('/api/services', { method: 'POST', token: consultant.token, body: { code: 'SVC-C', name: 'Consultant Service', category: 'advisory' } });
  assert.equal(svc.status, 201);
  assert.equal((await api(`/api/services/${svc.data.id}`, { method: 'PUT', token: consultant.token, body: { name: 'Renamed' } })).status, 200);
  assert.equal((await api('/api/engagements', { method: 'POST', token: consultant.token, body: { client_id: client.data.id, service_id: svc.data.id, title: 'C Engagement' } })).status, 201);
  assert.equal((await api('/api/tasks', { method: 'POST', token: consultant.token, body: { title: 'C Task' } })).status, 201);
  assert.equal((await api(`/api/services/${svc.data.id}`, { method: 'DELETE', token: consultant.token })).status, 403);

  // Accountant: billing full, clients view-only, engagements view-only, no role mgmt, no invoice delete
  assert.equal((await api('/api/clients', { token: accountant.token })).status, 200);
  assert.equal((await api('/api/clients', { method: 'POST', token: accountant.token, body: { name: 'A Client' } })).status, 403);
  assert.equal((await api(`/api/invoices/${invoice.data.id}`, { method: 'PUT', token: accountant.token, body: { notes: 'ok' } })).status, 200);
  assert.equal((await api(`/api/invoices/${invoice.data.id}/payments`, { method: 'POST', token: accountant.token, body: { amount: 100, method: 'bank_transfer' } })).status, 201);
  assert.equal((await api(`/api/invoices/${invoice.data.id}`, { method: 'DELETE', token: accountant.token })).status, 403);
  assert.equal((await api('/api/services', { token: accountant.token })).status, 200);
  assert.equal((await api('/api/services', { method: 'POST', token: accountant.token, body: { code: 'SVC-A', name: 'X' } })).status, 403);
  assert.equal((await api('/api/engagements', { method: 'POST', token: accountant.token, body: { client_id: client.data.id, service_id: svc.data.id, title: 'A' } })).status, 403);
  assert.equal((await api('/api/roles', { method: 'POST', token: accountant.token, body: { name: 'Nope', permissions: {} } })).status, 403);

  // Admin: bypass + can delete invoices/engagements
  assert.equal((await api('/api/settings', { method: 'PUT', token: adminToken, body: { company_name: 'Perm Firm' } })).status, 200);
  const adminInvoice = await api('/api/invoices', { method: 'POST', token: adminToken, body: { client_id: client.data.id, amount: 250, gst_rate: 0 } });
  assert.equal((await api(`/api/invoices/${adminInvoice.data.id}`, { method: 'DELETE', token: adminToken })).status, 204);
  const adminEng = await api('/api/engagements', { method: 'POST', token: adminToken, body: { client_id: client.data.id, service_id: svc.data.id, title: 'Admin Eng' } });
  assert.equal((await api(`/api/engagements/${adminEng.data.id}`, { method: 'DELETE', token: adminToken })).status, 204);

  // Roles table is authoritative: lock Senior Consultant's clients.create off
  const roles = (await api('/api/roles', { token: adminToken })).data;
  const sc = roles.find((r) => r.name === 'Senior Consultant');
  const locked = JSON.parse(JSON.stringify(sc.permissions));
  locked.clients.create = false;
  await api(`/api/roles/${sc.id}`, { method: 'PUT', token: adminToken, body: { permissions: locked } });
  assert.equal((await api('/api/clients', { method: 'POST', token: consultant.token, body: { name: 'Locked' } })).status, 403);
  assert.equal((await api('/api/clients', { token: consultant.token })).status, 200);

  // restore
  locked.clients.create = true;
  await api(`/api/roles/${sc.id}`, { method: 'PUT', token: adminToken, body: { permissions: locked } });
});