import { useEffect, useRef, useState } from 'react';
import { usePerm } from '../hooks/usePerm.js';
import { authHeaders } from '../utils/authHeader.js';

const SERVICE_CATEGORIES = [
  { value: 'taxation', label: 'Taxation' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'advisory', label: 'Advisory' },
  { value: 'audit', label: 'Audit' },
  { value: 'registration', label: 'Registration' },
  { value: 'other', label: 'Other' },
];

const EMPTY_SERVICE = { code: '', name: '', category: 'taxation', default_fee: '', is_recurring: false, description: '' };

function ServicesSection() {
  const can = usePerm();
  const canCreate = can('engagements.create');
  const canEdit = can('engagements.edit');
  const canDelete = can('engagements.delete');
  const canManage = canCreate || canEdit || canDelete;

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
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

  const categoryLabel = (v) => SERVICE_CATEGORIES.find((c) => c.value === v)?.label || 'Other';

  const visible = filter
    ? services.filter((s) => s.category === filter)
    : services;

  function startAdd() {
    setEditing('new');
    setForm(EMPTY_SERVICE);
  }

  function startEdit(service) {
    setEditing(service.id);
    setForm({
      code: service.code || '',
      name: service.name || '',
      category: service.category || 'other',
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
          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilter('')}
              className={`px-3 py-1 rounded-full font-label-md text-label-md border transition-colors ${filter === '' ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface hover:bg-surface-container-low'}`}
            >
              All
            </button>
            {SERVICE_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setFilter(c.value)}
                className={`px-3 py-1 rounded-full font-label-md text-label-md border transition-colors ${filter === c.value ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface hover:bg-surface-container-low'}`}
              >
                {c.label}
              </button>
            ))}
          </div>

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
                  <input className={inputCls} type="text" placeholder="e.g. GST Filing" value={form.name} onChange={set('name')} required />
                </div>
                <div>
                  <label className={labelCls}>Code</label>
                  <input className={`${inputCls} font-data-mono text-data-mono uppercase`} type="text" placeholder="e.g. GST-FILING" value={form.code} onChange={set('code')} />
                </div>
                <div>
                  <label className={labelCls}>Category</label>
                  <select className={inputCls} value={form.category} onChange={set('category')}>
                    {SERVICE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
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
          {visible.length === 0 ? (
            <div className="py-10 text-center font-body-md text-body-md text-on-surface-variant">
              {services.length === 0 ? 'No services yet. Add your first service.' : 'No services in this category.'}
            </div>
          ) : (
            <div className="border border-outline-variant rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant border-b border-outline-variant">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Code</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5">Default Fee</th>
                    <th className="px-4 py-2.5">Recurring</th>
                    {canManage && <th className="px-4 py-2.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {visible.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-2.5 font-body-md text-body-md text-on-surface">{s.name}</td>
                      <td className="px-4 py-2.5 font-data-mono text-data-mono text-on-surface-variant">{s.code || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[11px] font-medium">{categoryLabel(s.category)}</span>
                      </td>
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

const EMPTY_SETTINGS = {
  company_name: '',
  logo_url: '',
  address: '',
  state: '',
  phone: '',
  email: '',
  pan: '',
  gst: '',
  invoice_prefix: 'INV-',
  bank_name: '',
  account_name: '',
  account_number: '',
  ifsc: '',
};

const inputCls = 'w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary font-body-md text-body-md text-on-surface outline-none';
const labelCls = 'block font-label-md text-label-md text-on-surface-variant mb-1 uppercase';

export default function Settings() {
  const can = usePerm();
  const editable = can('settings.edit');
  const [form, setForm] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const logoRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings', { headers: authHeaders() });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
        if (!cancelled) setForm({ ...EMPTY_SETTINGS, ...data });
      } catch {
        /* keep empty defaults */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setForm({ ...EMPTY_SETTINGS, ...data });
      setNotice('Company settings saved.');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setNotice('Logo must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, logo_url: reader.result }));
    reader.readAsDataURL(file);
  }

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="flex-1 overflow-y-auto p-container-padding bg-background">
          <div className="max-w-[1080px] mx-auto space-y-stack-lg">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Settings</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">Manage your company details and preferences.</p>
            </div>

            {notice && (
              <div className="px-4 py-3 rounded-lg bg-primary-fixed/40 border border-outline-variant font-body-md text-body-md text-on-surface flex items-center justify-between">
                <span>{notice}</span>
                <button type="button" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface" onClick={() => setNotice('')}>Dismiss</button>
              </div>
            )}

            {/* Company Settings */}
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
              <div className="p-stack-md border-b border-outline-variant bg-surface-container-low">
                <h2 className="font-headline-md text-headline-md text-on-surface flex items-center">
                  <span className="material-symbols-outlined mr-2 text-primary">domain</span>
                  Company Details
                </h2>
              </div>
              {loading ? (
                <div className="p-container-padding text-on-surface-variant">Loading settings…</div>
              ) : (
                <form onSubmit={handleSave}>
                  <div className="p-container-padding space-y-stack-md">
                    {/* Logo Upload */}
                    <div className="md:col-span-2 flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 rounded border border-outline-variant bg-surface-container-high flex items-center justify-center overflow-hidden">
                          {form.logo_url ? (
                            <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
                          ) : (
                            <span className="material-symbols-outlined text-on-surface-variant">business</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
                        <button type="button" className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-lg font-label-md text-label-md hover:bg-surface-container-high transition-colors" onClick={() => logoRef.current?.click()}>
                          <span className="material-symbols-outlined text-[18px]">upload</span>
                          Upload Logo
                        </button>
                        <p className="text-xs text-on-surface-variant mt-1">PNG, JPG or SVG — max 2 MB.</p>
                      </div>
                      {form.logo_url && (
                        <button type="button" className="text-on-surface-variant hover:text-error transition-colors" onClick={() => setForm((prev) => ({ ...prev, logo_url: '' }))}>
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                      {/* Company Name */}
                      <div>
                        <label className={labelCls}>Company Name</label>
                        <input className={inputCls} type="text" value={form.company_name} onChange={set('company_name')} />
                      </div>

                      {/* PAN */}
                      <div>
                        <label className={labelCls}>PAN</label>
                        <input className={`${inputCls} font-data-mono text-data-mono uppercase`} type="text" placeholder="e.g. ABCDE1234F" maxLength={10} value={form.pan} onChange={set('pan')} />
                      </div>

                      {/* GST */}
                      <div>
                        <label className={labelCls}>GSTIN</label>
                        <input className={`${inputCls} font-data-mono text-data-mono uppercase`} type="text" placeholder="e.g. 22AAAAA0000A1Z5" maxLength={15} value={form.gst} onChange={set('gst')} />
                      </div>

                      {/* Contact Email */}
                      <div>
                        <label className={labelCls}>Contact Email</label>
                        <input className={inputCls} type="email" value={form.email} onChange={set('email')} />
                      </div>

                      {/* Contact Phone */}
                      <div>
                        <label className={labelCls}>Contact Phone</label>
                        <input className={inputCls} type="tel" value={form.phone} onChange={set('phone')} />
                      </div>

                      {/* Address */}
                      <div className="md:col-span-2">
                        <label className={labelCls}>Registered Address</label>
                        <textarea className={`${inputCls} resize-none`} rows="2" value={form.address} onChange={set('address')} />
                      </div>

                      {/* State */}
                      <div>
                        <label className={labelCls}>State</label>
                        <select className={inputCls} value={form.state} onChange={set('state')}>
                          <option value="">Select state</option>
                          {['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {/* Invoice Prefix */}
                      <div>
                        <label className={labelCls}>Invoice Prefix</label>
                        <input className={`${inputCls} font-data-mono text-data-mono`} type="text" value={form.invoice_prefix} onChange={set('invoice_prefix')} />
                        <p className="text-xs text-on-surface-variant mt-1">Example: {form.invoice_prefix || 'INV-'}001</p>
                      </div>
                    </div>

                    {/* Bank Details */}
                    <div className="border-t border-outline-variant pt-stack-md mt-stack-md">
                      <h3 className="font-headline-sm text-headline-sm text-on-surface mb-stack-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">account_balance</span>
                        Bank Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                        <div>
                          <label className={labelCls}>Bank Name</label>
                          <input className={inputCls} type="text" value={form.bank_name} onChange={set('bank_name')} />
                        </div>
                        <div>
                          <label className={labelCls}>Account Name</label>
                          <input className={inputCls} type="text" value={form.account_name} onChange={set('account_name')} />
                        </div>
                        <div>
                          <label className={labelCls}>Account Number</label>
                          <input className={`${inputCls} font-data-mono text-data-mono`} type="text" value={form.account_number} onChange={set('account_number')} />
                        </div>
                        <div>
                          <label className={labelCls}>IFSC Code</label>
                          <input className={`${inputCls} font-data-mono text-data-mono uppercase`} type="text" value={form.ifsc} onChange={set('ifsc')} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-container-padding py-3 bg-surface-container-low border-t border-outline-variant flex justify-end">
                    {editable ? (
                      <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        {saving ? 'Saving…' : 'Save Company Settings'}
                      </button>
                    ) : (
                      <span className="font-body-md text-body-md text-on-surface-variant flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">lock</span>
                        You have read-only access to settings.
                      </span>
                    )}
                  </div>
                </form>
              )}
            </section>

            <div className="h-8" />

            {/* Services Catalogue */}
            <ServicesSection />
          </div>
        </div>
  );
}
