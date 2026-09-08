import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { usePerm } from '../hooks/usePerm.js';
import { authHeaders } from '../utils/authHeader.js';
import { downloadClientsTemplate } from '../utils/xlsxTemplate.js';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 5;

const TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'proprietor', label: 'Proprietor' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llp', label: 'LLP' },
  { value: 'private_limited', label: 'Private Limited' },
  { value: 'others', label: 'Others' },
];

function typeLabel(value) {
  const found = TYPE_OPTIONS.find((o) => o.value === value);
  if (found) return found.label;
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeType(raw) {
  const v = (raw || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (TYPE_OPTIONS.some((o) => o.value === v)) return v;
  const byLabel = TYPE_OPTIONS.find((o) => o.label.toLowerCase() === (raw || '').trim().toLowerCase());
  if (byLabel) return byLabel.value;
  if (v === 'business' || v === 'pvt_ltd' || v === 'private ltd') return 'private_limited';
  if (v === 'proprietorship') return 'proprietor';
  if (v === 'huf' || v === 'aop_boi') return 'others';
  return v || 'others';
}

function normalizeStatus(raw) {
  const v = (raw || '').trim().toLowerCase();
  return ['active', 'inactive', 'prospect'].includes(v) ? v : 'active';
}

const STATUS_BADGE = {
  active: 'bg-[#DCFCE7] text-[#166534]',
  inactive: 'bg-surface-variant text-on-surface-variant',
  prospect: 'bg-[#FEF3C7] text-[#92400E]',
};

const AVATAR_COLORS = ['bg-[#0b6bcb]', 'bg-[#7c3aed]', 'bg-[#0d9488]', 'bg-[#d97706]', 'bg-[#4b5563]'];

function initials(name) {
  return (name || '?').split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function waLink(client) {
  const digits = (client.phone || '').replace(/\D+/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${client.name}, message from Vyom CRM.`)}`;
}

const EMPTY_FORM = { name: '', client_type: 'individual', email: '', phone: '', status: 'active' };

async function handleDownloadTemplate() {
  let names = [];
  try {
    const res = await fetch('/api/services', { headers: authHeaders() });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (Array.isArray(json)) names = json.map((s) => s.name).filter(Boolean);
    }
  } catch { /* fall back to no services drop-down */ }
  downloadClientsTemplate(names);
}

async function api(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: authHeaders(body !== undefined ? { 'Content-Type': 'application/json' } : undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function Clients() {
  const navigate = useNavigate();
  const location = useLocation();
  const can = usePerm();
  const { data, error, loading, reload } = useFetch('/clients');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const fileRef = useRef(null);

  const clients = Array.isArray(data) ? data : [];

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') { setModal(null); setDeleteTarget(null); setImportOpen(false); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (location.state?.notice) {
      setNotice(location.state.notice);
      window.history.replaceState({}, '');
    }
  }, []);

  const stats = useMemo(() => {
    const total = clients.length;
    const typeCounts = {};
    clients.forEach((c) => {
      const key = c.client_type || 'others';
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    });
    const pct = (n) => total ? `${Math.round((n / total) * 100)}%` : '0%';
    const cards = [{ label: 'Total Clients', count: total, pct: '100%' }];
    TYPE_OPTIONS.forEach((o) => {
      const count = typeCounts[o.value] || 0;
      if (count > 0) cards.push({ label: o.label, count, pct: pct(count) });
    });
    return cards;
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (!q) return true;
      return [c.name, c.email, c.client_type].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [clients, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  function pageList(total, current) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const wanted = new Set([1, 2, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
    const sorted = [...wanted].sort((a, b) => a - b);
    const out = [];
    sorted.forEach((p, i) => {
      if (i && p - sorted[i - 1] > 1) out.push('…');
      out.push(p);
    });
    return out;
  }

  function openAdd() { setForm(EMPTY_FORM); setFormError(''); setModal({ mode: 'add' }); }

  function openEdit(client) {
    const legacyType = client.client_type === 'business' ? 'private_limited' : client.client_type;
    setForm({
      name: client.name || '',
      client_type: TYPE_OPTIONS.some((o) => o.value === legacyType) ? legacyType : 'others',
      email: client.email || '',
      phone: client.phone || '',
      status: normalizeStatus(client.status),
    });
    setFormError('');
    setModal({ mode: 'edit', client });
  }

  async function submitForm(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        client_type: form.client_type,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        status: form.status,
      };
      if (modal.mode === 'edit') await api('PUT', `/clients/${modal.client.id}`, payload);
      else await api('POST', '/clients', payload);
      setModal(null);
      reload();
      setNotice(modal.mode === 'edit' ? 'Client updated.' : 'Client added.');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api('DELETE', `/clients/${deleteTarget.id}`);
      setDeleteTarget(null);
      reload();
      setNotice('Client deleted.');
    } catch (err) {
      setDeleteTarget(null);
      setNotice(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const header = ['Name', 'Assessee Type', 'Email', 'Phone', 'City', 'Status'];
    const lines = filtered.map((c) =>
      [c.name, typeLabel(c.client_type), c.email, c.phone, c.city, c.status].map(csvEscape).join(',')
    );
    const blob = new Blob([[header.map(csvEscape).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clients.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let table;
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        table = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      } else {
        table = parseCsv(await file.text());
      }
    } catch {
      setNotice('Could not read that file.');
      return;
    }
    if (table.length < 2) {
      setNotice('No data rows found in the CSV.');
      return;
    }
    const headers = table[0].map((h) => h.trim().toLowerCase());
    const col = (...names) => names.map((n) => headers.indexOf(n)).find((i) => i >= 0) ?? -1;
    const iName = col('name', 'client name');
    if (iName < 0) {
      setNotice('CSV must include a "Name" column.');
      return;
    }
    const iType = col('assessee type', 'type', 'client_type');
    const iEmail = col('email', 'email address');
    const iPhone = col('phone', 'phone number');
    const iStatus = col('status');
    const iCity = col('city');
    const iServices = col('services', 'service', 'service names', 'service(s)');

    let services = [];
    try {
      const res = await fetch('/api/services', { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        services = Array.isArray(json) ? json : [];
      }
    } catch { /* services stay empty */ }
    const byName = new Map();
    services.forEach((s) => byName.set(String(s.name || '').trim().toLowerCase(), s.id));

    function serviceIdsFor(r) {
      const raw = iServices >= 0 ? String(r[iServices] || '') : '';
      if (raw.trim()) {
        const ids = raw
          .split(/[,;|]+/)
          .map((n) => byName.get(n.trim().toLowerCase()))
          .filter(Boolean);
        if (ids.length) return [...new Set(ids)];
      }
      return services.length ? [services[0].id] : [];
    }

    setImporting(true);
    let created = 0;
    let failed = 0;
    for (const r of table.slice(1)) {
      const name = (r[iName] || '').trim();
      if (!name) continue;
      const service_ids = serviceIdsFor(r);
      if (!service_ids.length) { failed += 1; continue; }
      try {
        const sVal = normalizeStatus(iStatus >= 0 ? r[iStatus] : '');
        await api('POST', '/clients', {
          name,
          client_type: normalizeType(iType >= 0 ? r[iType] : ''),
          email: (iEmail >= 0 ? r[iEmail] : '').trim() || null,
          phone: (iPhone >= 0 ? r[iPhone] : '').trim() || null,
          city: (iCity >= 0 ? r[iCity] : '').trim() || null,
          service_ids,
          ...(sVal === 'active' || sVal === 'inactive' ? { status: sVal } : {}),
        });
        created += 1;
      } catch {
        failed += 1;
      }
    }
    setImporting(false);
    reload();
    setNotice(`Imported ${created} client(s)${failed ? `, ${failed} failed` : ''}.`);
  }

  const inputCls = 'w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary font-body-md text-body-md text-on-surface outline-none';
  const labelCls = 'block font-label-md text-label-md text-on-surface-variant mb-1 uppercase';

  return (
    <>
      {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-container-padding bg-background">
          <div className="max-w-[1440px] mx-auto">
            {/* Page Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-stack-lg gap-4">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-background">Clients</h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  Every assessee you work with — individuals and businesses, with the services they&rsquo;ve opted into.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {can('clients.create') && (
                  <button
                    type="button"
                    disabled={importing}
                    className="px-4 py-2.5 border border-outline-variant rounded-lg font-label-md text-label-md bg-surface-container-lowest hover:bg-surface-container-low transition-colors text-on-surface flex items-center gap-2 shadow-card disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setImportOpen(true)}
                  >
                    <span className="material-symbols-outlined text-[18px]">upload</span>
                    {importing ? 'Importing…' : 'Import'}
                  </button>
                )}
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={handleImportFile} />
                <button
                  type="button"
                  className="px-4 py-2.5 border border-outline-variant rounded-lg font-label-md text-label-md bg-surface-container-lowest hover:bg-surface-container-low transition-colors text-on-surface flex items-center gap-2 shadow-card"
                  onClick={exportCsv}
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Export CSV
                </button>
                {can('clients.create') && (
                  <>
                    <button
                      type="button"
                      className="px-4 py-2.5 border border-outline-variant rounded-lg font-label-md text-label-md bg-surface-container-lowest hover:bg-surface-container-low transition-colors text-primary flex items-center gap-2 shadow-card"
                      onClick={() => navigate('/clients/new/quick')}
                    >
                      <span className="material-symbols-outlined text-[18px]">bolt</span>
                      Quick Add
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors flex items-center gap-2 shadow-card"
                      onClick={() => navigate('/clients/new')}
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      Add Client
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-stack-lg" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(220px, 1fr))` }}>
              {stats.map((s) => (
                <div key={s.label} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-1 shadow-card">
                  <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{s.label}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="font-headline-lg text-headline-lg text-on-surface">{s.count}</span>
                    <span className="font-label-md text-label-md text-secondary">{s.pct}</span>
                  </div>
                </div>
              ))}
            </div>

            {notice && (
              <div className="mb-stack-md px-4 py-3 rounded-lg bg-primary-fixed/40 border border-outline-variant font-body-md text-body-md text-on-surface flex items-center justify-between">
                <span>{notice}</span>
                <button type="button" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface" onClick={() => setNotice('')}>Dismiss</button>
              </div>
            )}

            {/* Data Table Card */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card overflow-hidden">
              {/* Table Toolbar */}
              <div className="flex flex-col sm:flex-row items-center gap-3 p-4 border-b border-outline-variant bg-surface-container-lowest">
                <div className="relative w-full sm:w-72">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                  <input
                    className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-transparent focus:border-primary rounded-lg font-body-md text-body-md text-on-surface focus:ring-1 focus:ring-primary outline-none transition-colors"
                    placeholder="Search by name, email, or assessee type"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="w-full sm:w-auto bg-surface-container-low border border-transparent rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <span className="ml-auto text-sm text-on-surface-variant whitespace-nowrap">
                  Showing {filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)}` : '0'} of {filtered.length} clients
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant">
                      <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Client Name</th>
                      <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Assessee Type</th>
                      <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Services</th>
                      <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="font-data-mono text-data-mono text-on-surface divide-y divide-outline-variant">
                    {loading && (
                      <tr>
                        <td className="px-6 py-6 text-on-surface-variant" colSpan="7">Loading clients…</td>
                      </tr>
                    )}
                    {!loading && error && (
                      <tr>
                        <td className="px-6 py-6 text-error" colSpan="7">{error}</td>
                      </tr>
                    )}
                    {!loading && !error && !rows.length && (
                      <tr>
                        <td className="px-6 py-6 text-on-surface-variant" colSpan="7">
                          {filtered.length ? 'No clients on this page.' : clients.length ? 'No clients match your filters.' : 'No clients yet. Use "Add Client" or import a CSV.'}
                        </td>
                      </tr>
                    )}
                    {!loading && !error && rows.map((client, i) => (
                      <tr key={client.id} className={`hover:bg-surface-container-low transition-colors group${i % 2 === 1 ? ' bg-[#FAF8FD]' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-full text-on-primary flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor(client.name)}`}>
                              {initials(client.name)}
                            </div>
                            <div className="min-w-0">
                              {can('clients.edit') ? (
                                <button type="button" className="text-left cursor-pointer hover:text-secondary transition-colors font-medium block truncate max-w-[220px]" onClick={() => navigate(`/clients/${client.id}/edit`)}>
                                  {client.name}
                                </button>
                              ) : (
                                <span className="text-left font-medium block truncate max-w-[220px]">{client.name}</span>
                              )}
                              <div className="text-xs text-on-surface-variant font-normal truncate max-w-[220px]">
                                {[client.city, client.state].filter(Boolean).join(', ') || (typeLabel(client.client_type))}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-on-surface-variant">{typeLabel(client.client_type)}</td>
                        <td className="px-6 py-4">{client.email || '—'}</td>
                        <td className="px-6 py-4">{client.phone || '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[client.status] || STATUS_BADGE.inactive}`}>
                            {(client.status || 'inactive').replace(/^\w/, (c) => c.toUpperCase())}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {Array.isArray(client.services) && client.services.length ? (
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {client.services.slice(0, 2).map((s) => (
                                <span key={s.id} className="inline-flex items-center px-2 py-0.5 bg-primary text-white rounded-full text-[11px] font-medium">
                                  {s.name}
                                </span>
                              ))}
                              {client.services.length > 2 && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-surface-container-high text-on-surface-variant rounded-full text-[11px] font-medium">
                                  +{client.services.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-on-surface-variant">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(() => {
                            const link = waLink(client);
                            if (link) {
                              return (
                                <a href={link} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="text-on-surface-variant hover:text-[#075e54] inline-block">
                                  <span className="material-symbols-outlined text-[20px]">chat</span>
                                </a>
                              );
                            }
                            return null;
                          })()}
                          {can('clients.edit') && (
                            <button type="button" title="Edit" className="text-on-surface-variant hover:text-secondary" onClick={() => navigate(`/clients/${client.id}/edit`)}>
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                            </button>
                          )}
                          {can('clients.delete') && (
                            <button type="button" title="Delete" className="text-on-surface-variant hover:text-error" onClick={() => setDeleteTarget(client)}>
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
                <span className="font-body-md text-body-md text-on-surface-variant">
                  Showing {filtered.length ? start + 1 : 0} to {Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length} clients
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    className="px-3 py-1 border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-low font-label-md text-label-md disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setPage(safePage - 1)}
                  >
                    Previous
                  </button>
                  {pageList(totalPages, safePage).map((p, i) =>
                    p === '…' ? (
                      <span key={`gap-${i}`} className="px-2 text-on-surface-variant">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={`px-3 py-1 rounded font-label-md text-label-md ${p === safePage ? 'bg-primary text-white border border-primary' : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    className="px-3 py-1 border border-outline-variant rounded text-on-surface-variant hover:bg-surface-container-low font-label-md text-label-md disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setPage(safePage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Add / Edit / View Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div
            className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-stack-md border-b border-outline-variant flex items-center justify-between">
              <h3 className="font-headline-md text-headline-md text-on-surface">
                {modal.mode === 'view' ? 'Client Details' : modal.mode === 'edit' ? 'Edit Client' : 'Add Client'}
              </h3>
              <button type="button" className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-low" onClick={() => setModal(null)}>
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {modal.mode === 'view' ? (
              <div className="p-container-padding space-y-stack-md font-body-md text-body-md">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
                  <div><p className={labelCls}>Name</p><p className="text-on-surface">{modal.client.name}</p></div>
                  <div><p className={labelCls}>Assessee Type</p><p className="text-on-surface">{typeLabel(modal.client.client_type)}</p></div>
                  <div><p className={labelCls}>Email</p><p className="text-on-surface">{modal.client.email || '—'}</p></div>
                  <div><p className={labelCls}>Phone</p><p className="text-on-surface">{modal.client.phone || '—'}</p></div>
                  <div><p className={labelCls}>City</p><p className="text-on-surface">{modal.client.city || '—'}</p></div>
                  <div>
                    <p className={labelCls}>Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[modal.client.status] || STATUS_BADGE.inactive}`}>
                      {(modal.client.status || 'inactive').replace(/^\w/, (c) => c.toUpperCase())}
                    </span>
                  </div>
                </div>
                <div className="pt-stack-md border-t border-outline-variant flex justify-end">
                  <button type="button" className="px-4 py-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={() => setModal(null)}>Close</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitForm}>
                <div className="p-container-padding space-y-stack-md">
                  {formError && (
                    <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">{formError}</p>
                  )}
                  <div>
                    <label className={labelCls}>Name *</label>
                    <input className={inputCls} type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className={labelCls}>Assessee Type</label>
                    <select className={inputCls} value={form.client_type} onChange={(e) => setForm({ ...form, client_type: e.target.value })}>
                      {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
                    <div>
                      <label className={labelCls}>Email</label>
                      <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input className={inputCls} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Status (optional)</label>
                    <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="px-container-padding py-3 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3">
                  <button type="button" className="px-4 py-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={() => setModal(null)}>Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity disabled:opacity-50">
                    {saving ? 'Saving…' : modal.mode === 'edit' ? 'Save Changes' : 'Add Client'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Import Dialog */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setImportOpen(false)}>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card-lg w-full max-w-md p-container-padding" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Import Clients</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-stack-md">
              Download the Excel template below — it has dropdown lists for Assessee Type, Status and Services. Fill it in and upload the file.
            </p>
            <p className="font-data-mono text-data-mono text-on-surface bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 mb-stack-md">
              Name, Assessee Type, Email, Phone, City, Status, Services (optional)
            </p>
            <ul className="font-body-md text-body-md text-on-surface-variant mb-stack-lg list-disc pl-5 space-y-1">
              <li>Assessee Type: Individual, Proprietor, Partnership, LLP, Private Limited, or Others</li>
              <li>Status (optional): Active or Inactive — left blank, clients are created as Active</li>
              <li>Services (optional): pick from the drop-down — these match the services set up in Settings. Leave blank and each imported client is assigned to your first available service.</li>
              <li>Only "Name" is required in each row.</li>
            </ul>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-low flex items-center justify-center gap-2"
                onClick={handleDownloadTemplate}
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download Excel Template
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                onClick={() => { setImportOpen(false); fileRef.current?.click(); }}
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Choose File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card-lg w-full max-w-sm p-container-padding" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Delete Client?</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
              This will permanently delete <strong className="text-on-surface">{deleteTarget.name}</strong>. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" className="px-4 py-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" disabled={deleting} className="px-4 py-2 bg-error text-on-error rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity disabled:opacity-50" onClick={confirmDelete}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
