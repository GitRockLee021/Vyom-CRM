import { useEffect, useRef, useState } from 'react';
import { usePerm } from '../hooks/usePerm.js';
import { authHeaders } from '../utils/authHeader.js';

const EMPTY_SERVICE = { name: '', default_fee: '', is_recurring: false, description: '' };

function ServicesSection() {
  const can = usePerm();
  const canCreate = can('engagements.create');
  const canEdit = can('engagements.edit');
  const canDelete = can('engagements.delete');
  const canManage = canCreate || canEdit || canDelete;

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_SERVICE);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/services', { headers: authHeaders() });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to load services');
      setServices(Array.isArray(data) ? data : []);
    } catch (err) {
      setNotice(err.message);
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

  async function handleDelete(service) {
    if (!window.confirm(`Delete the service "${service.name}"?`)) return;
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      setNotice('Service deleted.');
      await load();
    } catch (err) {
      setNotice(err.message);
    }
  }

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
      <div className="p-stack-md border-b border-outline-variant bg-surface-container-low flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center">
          <span className="material-symbols-outlined mr-2 text-primary">handyman</span>
          Services
        </h2>
        {canCreate && (
          <button
            type="button"
            onClick={startAdd}
            className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add Service
          </button>
        )}
      </div>

      {notice && (
        <div className="mx-container-padding mt-stack-md px-4 py-3 rounded-lg bg-primary-fixed/40 border border-outline-variant font-body-md text-body-md text-on-surface flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface" onClick={() => setNotice('')}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="p-container-padding text-on-surface-variant">Loading services…</div>
      ) : (
        <div className="p-container-padding space-y-stack-md">
          {/* Add / Edit form */}
          {editing && (
            <form onSubmit={handleSave} className="border border-outline-variant rounded-lg p-stack-md bg-surface-container-low space-y-stack-md">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  {editing === 'new' ? 'Add Service' : 'Edit Service'}
                </h3>
                <button type="button" className="text-on-surface-variant hover:text-on-surface" onClick={cancelEdit}>
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                <div>
                  <label className={labelCls}>Service Name <span className="text-error">*</span></label>
                  <input className={inputCls} type="text" placeholder="e.g. Bookkeeping" value={form.name} onChange={set('name')} required />
                </div>
                <div>
                  <label className={labelCls}>Default Fee (₹)</label>
                  <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.00" value={form.default_fee} onChange={set('default_fee')} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Description</label>
                  <textarea className={`${inputCls} resize-none`} rows="2" value={form.description} onChange={set('description')} />
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <input id="svc-recurring" type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} />
                  <label htmlFor="svc-recurring" className="font-body-md text-body-md text-on-surface">Recurring service (e.g. monthly/annual filings)</label>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="px-4 py-2 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={cancelEdit}>Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity disabled:opacity-50">
                  {saving ? 'Saving…' : editing === 'new' ? 'Add Service' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* Services list */}
          {services.length === 0 ? (
            <div className="py-10 text-center font-body-md text-body-md text-on-surface-variant">
              No services yet. Add your first service.
            </div>
          ) : (
            <div className="border border-outline-variant rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant border-b border-outline-variant">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Default Fee</th>
                    <th className="px-4 py-2.5">Recurring</th>
                    {canManage && <th className="px-4 py-2.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {services.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-2.5 font-body-md text-body-md text-on-surface">{s.name}</td>
                      <td className="px-4 py-2.5 font-data-mono text-data-mono text-on-surface">{s.default_fee != null ? `₹${Number(s.default_fee).toLocaleString('en-IN')}` : '—'}</td>
                      <td className="px-4 py-2.5">
                        {s.is_recurring ? (
                          <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed/30 text-on-surface text-[11px] font-medium">Recurring</span>
                        ) : (
                          <span className="font-body-md text-body-md text-on-surface-variant">—</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {canEdit && (
                              <button type="button" className="text-on-surface-variant hover:text-secondary p-1" title="Edit" onClick={() => startEdit(s)}>
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                            )}
                            {canDelete && (
                              <button type="button" className="text-on-surface-variant hover:text-error p-1" title="Delete" onClick={() => handleDelete(s)}>
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default ServicesSection;
