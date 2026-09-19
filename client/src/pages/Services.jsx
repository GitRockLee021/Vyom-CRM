import { useEffect, useMemo, useState } from 'react';
import { usePerm } from '../hooks/usePerm.js';
import { authHeaders } from '../utils/authHeader.js';
import Pagination from '../components/Pagination.jsx';

const EMPTY_SERVICE = { name: '', default_fee: '', is_recurring: false, description: '' };
const PAGE_SIZE = 8;

const inputCls = 'w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary font-body-md text-body-md text-on-surface outline-none';
const labelCls = 'block font-label-md text-label-md text-on-surface-variant mb-1 uppercase';

function serviceIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('book')) return 'menu_book';
  if (n.includes('gst')) return 'receipt_long';
  if (n.includes('tds')) return 'fact_check';
  if (n.includes('payroll')) return 'payments';
  if (n.includes('audit')) return 'task_alt';
  if (n.includes('corpor') || n.includes('incorpor')) return 'domain';
  if (n.includes('report') || n.includes('cma') || n.includes('project')) return 'summarize';
  return 'handyman';
}

export default function Services() {
  const can = usePerm();
  const canCreate = can('engagements.create');
  const canEdit = can('engagements.edit');
  const canDelete = can('engagements.delete');

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [freqFilter, setFreqFilter] = useState('');
  const [sortBy, setSortBy] = useState('fee_high');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_SERVICE);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/services', { headers: authHeaders() });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to load services');
      setServices(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); // eslint-disable-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    setPage(1);
  }, [search, freqFilter, sortBy]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = services.filter((s) => {
      if (freqFilter === 'recurring' && !s.is_recurring) return false;
      if (freqFilter === 'oneoff' && s.is_recurring) return false;
      if (q && !`${s.name} ${s.description || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...list];
    if (sortBy === 'name') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortBy === 'fee_high') sorted.sort((a, b) => Number(a.default_fee) - Number(b.default_fee));
    if (sortBy === 'fee_low') sorted.sort((a, b) => Number(b.default_fee) - Number(a.default_fee));
    return sorted;
  }, [services, search, freqFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function startAdd() {
    setEditing('new');
    setForm(EMPTY_SERVICE);
  }

  function startEdit(service) {
    setEditing(service.id);
    setForm({
      name: service.name || '',
      default_fee: service.default_fee != null ? String(service.default_fee) : '',
      is_recurring: Boolean(service.is_recurring),
      description: service.description || '',
    });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY_SERVICE);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { setNotice('Service name is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        default_fee: form.default_fee === '' ? null : Number(form.default_fee),
      };
      const res = await fetch(
        editing === 'new' ? '/api/services' : `/api/services/${editing}`,
        {
          method: editing === 'new' ? 'POST' : 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setNotice(editing === 'new' ? 'Service added.' : 'Service updated.');
      cancelEdit();
      await load();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/services/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      setNotice('Service deleted.');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setNotice(err.message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const fmtFee = (fee) => (fee != null && fee !== '' ? `₹${Number(fee).toLocaleString('en-IN')}` : '—');

  return (
    <div className="space-y-stack-lg">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-6">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-background">Services</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Your firm&apos;s services &amp; pricing &mdash; used when creating invoices and engagements.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreate && (
              <button type="button" onClick={startAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors">
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Service
              </button>
            )}
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card overflow-hidden flex flex-col">
          <div className="p-stack-md border-b border-outline-variant bg-surface-container-low flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-headline-md text-headline-md text-on-surface flex items-center">
              <span className="material-symbols-outlined mr-2 text-primary">handyman</span>
              Service List
            </h3>
            <span className="font-label-md text-label-md text-on-surface-variant">
              {filtered.length} service{filtered.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="p-stack-md border-b border-outline-variant bg-surface-bright flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
              <input
                className="w-full bg-surface-container-lowest border border-outline-variant rounded pl-9 pr-3 py-1.5 font-body-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                placeholder="Search services..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <label htmlFor="freq-filter" className="font-label-md text-label-md text-on-surface-variant whitespace-nowrap">Frequency:</label>
              <select
                id="freq-filter"
                value={freqFilter}
                onChange={(e) => setFreqFilter(e.target.value)}
                className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-1.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              >
                <option value="">All</option>
                <option value="recurring">Recurring</option>
                <option value="oneoff">One-off</option>
              </select>
              <label htmlFor="sort-by" className="font-label-md text-label-md text-on-surface-variant whitespace-nowrap">Sort:</label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-1.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
              >
                <option value="fee_high">Fee (high &rarr; low)</option>
                <option value="fee_low">Fee (low &rarr; high)</option>
                <option value="name">Name A&ndash;Z</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant border-b border-outline-variant">
                <tr>
                  <th className="p-4 font-semibold uppercase tracking-wider">Service</th>
                  <th className="p-4 font-semibold uppercase tracking-wider">Default Fee</th>
                  <th className="p-4 font-semibold uppercase tracking-wider">Frequency</th>
                  <th className="p-4 font-semibold uppercase tracking-wider">Clients</th>
                  <th className="p-4 font-semibold uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md text-on-surface divide-y divide-outline-variant bg-surface-container-lowest">
                {loading && (
                  <tr>
                    <td className="p-4 text-on-surface-variant" colSpan="5">Loading services…</td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td className="p-4 text-error" colSpan="5">{error}</td>
                  </tr>
                )}
                {!loading && !error && !rows.length && (
                  <tr>
                    <td className="p-4 text-on-surface-variant" colSpan="5">
                      {filtered.length ? 'No services on this page.' : services.length ? 'No services match your filters.' : 'No services yet. Click "Add Service" to create your service list.'}
                    </td>
                  </tr>
                )}
                {!loading && !error && rows.map((s, i) => (
                  <tr key={s.id} className={`hover:bg-surface-bright transition-colors ${i % 2 === 1 ? 'bg-background' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center text-primary shrink-0 ${s.is_recurring ? 'bg-primary-fixed/40' : 'bg-tertiary-fixed/30 text-tertiary'}`}>
                          <span className="material-symbols-outlined text-[18px]">{serviceIcon(s.name)}</span>
                        </div>
                        <div>
                          <div className="font-body-md text-body-md font-semibold text-on-surface">{s.name}</div>
                          {s.description && <div className="text-xs text-on-surface-variant">{s.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className={`p-4 ${s.default_fee != null ? 'font-data-mono text-data-mono text-on-surface' : 'text-on-surface-variant'}`}>
                      {fmtFee(s.default_fee)}
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${s.is_recurring ? 'bg-tertiary-fixed/30 text-tertiary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        {s.is_recurring ? 'Recurring' : 'One-off'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-data-mono text-data-mono text-on-surface">{(s.client_count ?? 0).toLocaleString('en-IN')}</span>
                      <span className="ml-1.5 text-on-surface-variant">client{(s.client_count ?? 0) === 1 ? '' : 's'}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1">
                        {canEdit && (
                          <button type="button" className="text-on-surface-variant hover:text-primary p-1 transition-colors" title="Edit" onClick={() => startEdit(s)}>
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" className="text-on-surface-variant hover:text-error p-1 transition-colors" title="Delete" onClick={() => setDeleteTarget(s)}>
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            label="services"
          />
        </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={cancelEdit}>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-stack-md border-b border-outline-variant flex items-center justify-between sticky top-0 bg-surface-container-lowest">
              <h3 className="font-headline-md text-headline-md text-on-surface flex items-center">
                <span className="material-symbols-outlined mr-2 text-primary">handyman</span>
                {editing === 'new' ? 'Add Service' : 'Edit Service'}
              </h3>
              <button type="button" className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors" onClick={cancelEdit} title="Close">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-container-padding space-y-stack-md">
              <div>
                <label className={labelCls}>Service Name <span className="text-error">*</span></label>
                <input className={inputCls} type="text" placeholder="e.g. Bookkeeping" value={form.name} onChange={set('name')} required />
              </div>
              <div>
                <label className={labelCls}>Default Fee (₹)</label>
                <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.00" value={form.default_fee} onChange={set('default_fee')} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea className={`${inputCls} resize-none`} rows="2" placeholder="What the engagement covers" value={form.description} onChange={set('description')} />
              </div>
              <div className="flex items-center gap-2">
                <input id="svc-recurring" type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} />
                <label htmlFor="svc-recurring" className="font-body-md text-body-md text-on-surface">Recurring service (e.g. monthly/annual filings)</label>
              </div>
              {notice && <p className="px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">{notice}</p>}
              <div className="pt-2 flex justify-end gap-3 border-t border-outline-variant">
                <button type="button" className="px-4 py-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={cancelEdit}>Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  {saving ? 'Saving…' : editing === 'new' ? 'Add Service' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card-lg w-full max-w-sm p-container-padding" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Delete Service?</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-stack-lg">
              Permanently remove <strong className="text-on-surface">{deleteTarget.name}</strong> from your service list. Existing invoices that reference it keep their fee.
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

    </div>
  );
}