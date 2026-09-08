const BASE = 'http://localhost:5000/api';
const api = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

const stamp = Date.now();
const reg = await api('/auth/register', { method: 'POST', body: { full_name: 'Trace Ginkgo', email: `trc-${stamp}@example.com`, password: 'SmokePass123!', company_name: 'Trace Firm' } });
console.log('register:', reg.status, JSON.stringify(reg.data).slice(0, 300));

let token = reg.data?.token || reg.data?.access_token || reg.data?.data?.token;
if (!token) {
  const login = await api('/auth/login', { method: 'POST', body: { email: `trc-${stamp}@example.com`, password: 'SmokePass123!' } });
  console.log('login:', login.status, JSON.stringify(login.data).slice(0, 300));
  token = login.data?.token || login.data?.data?.token;
}
if (!token) { console.log('NO TOKEN - abort'); process.exit(0); }

const svc = await api('/services', { method: 'POST', token, body: { name: 'GST Filing', category: 'taxation', is_recurring: true } });
const client = await api('/clients', { method: 'POST', token, body: { name: 'Trace Co', client_type: 'business', service_ids: [svc.data.id] } });
const list = await api('/tasks', { token });

console.log('=== raw due_date values from API ===');
if (!Array.isArray(list.data)) { console.log('NOT ARRAY:', JSON.stringify(list.data).slice(0, 200)); process.exit(0); }
for (const t of list.data) {
  console.log(`"${t.title}" => due_date=${JSON.stringify(t.due_date)} (typeof ${typeof t.due_date})`);
  const d = new Date((t.due_date || '') + 'T00:00:00');
  console.log(`   parsed: ${isNaN(d) ? 'INVALID DATE' : d.toISOString()} => inSep2026? ${!isNaN(d) && d.getFullYear()===2026 && d.getMonth()===8}`);
}