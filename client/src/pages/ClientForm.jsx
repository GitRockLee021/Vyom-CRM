import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePerm } from '../hooks/usePerm.js';
import AccessDenied from '../components/AccessDenied.jsx';
import { authHeaders } from '../utils/authHeader.js';

const TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'proprietor', label: 'Proprietor' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llp', label: 'LLP' },
  { value: 'private_limited', label: 'Private Limited' },
  { value: 'others', label: 'Others' },
];

const STATUS_OPTIONS = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const EMPTY_FORM = {
  client_type: 'individual', name: '',
  contact_person: '', email: '', phone: '',
  address_line1: '', address_line2: '', city: '', state: '', pincode: '',
  gstin: '', pan: '', tan: '',
  status: 'active', notes: '', assigned_to: '',
};

const ROLE_LABELS = { admin: 'Administrator', accountant: 'Accountant', consultant: 'Consultant' };

const SERVICE_CATEGORY_LABELS = {
  taxation: 'Taxation',
  compliance: 'Compliance',
  advisory: 'Advisory',
  audit: 'Audit & Compliance',
  registration: 'Registration',
  other: 'Other',
};
const SERVICE_CATEGORY_ORDER = ['taxation', 'advisory', 'compliance', 'audit', 'registration', 'other'];

export default function ClientForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromInvoice = Boolean(location.state?.fromInvoice);
  const can = usePerm();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [members, setMembers] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceIds, setServiceIds] = useState([]);
  const [servicesOpen, setServicesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [teamRes, servicesRes] = await Promise.all([
          fetch('/api/team', { headers: authHeaders() }),
          fetch('/api/services', { headers: authHeaders() }),
        ]);
        const team = await teamRes.json().catch(() => null);
        const svc = await servicesRes.json().catch(() => null);
        if (!cancelled) {
          if (team?.members) setMembers(team.members.filter((m) => m.is_active));
          if (Array.isArray(svc)) setServices(svc);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${id}`, { headers: authHeaders() });
        const client = await res.json().catch(() => null);
        if (!res.ok) throw new Error(client?.error || `Request failed (${res.status})`);
        if (cancelled) return;
        const legacyType = client.client_type === 'business' ? 'private_limited' : client.client_type;
        setForm({
          client_type: TYPE_OPTIONS.some((o) => o.value === legacyType) ? legacyType : 'others',
          name: client.name || '',
          contact_person: client.contact_person || '',
          email: client.email || '',
          phone: client.phone || '',
          address_line1: client.address_line1 || '',
          address_line2: client.address_line2 || '',
          city: client.city || '',
          state: client.state || '',
          pincode: client.pincode || '',
          gstin: client.gstin || '',
          pan: client.pan || '',
          tan: client.tan || '',
          status: client.status || 'active',
          notes: client.notes || '',
          assigned_to: client.assigned_to || '',
        });
        setServiceIds((Array.isArray(client.services) ? client.services : []).map((s) => s.id));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  function set(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function toggleService(serviceId) {
    setServiceIds((prev) => prev.includes(serviceId) ? prev.filter((x) => x !== serviceId) : [...prev, serviceId]);
  }

  const selectedServices = services.filter((s) => serviceIds.includes(s.id));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {};
      for (const [k, v] of Object.entries(form)) {
        if (v !== '') payload[k] = v;
      }
      payload.service_ids = serviceIds;
      const res = await fetch(isEdit ? `/api/clients/${id}` : '/api/clients', {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      navigate(fromInvoice ? '/invoices/new' : '/clients');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-DEFAULT font-body-md text-body-md text-primary focus:outline-none focus:border-inverse-surface focus:border-2 transition-all';
  const selectCls = `${inputCls} cursor-pointer appearance-none bg-surface-container-low`;
  const monoInputCls = `${inputCls} font-data-mono text-data-mono uppercase`;
  const labelCls = 'font-label-md text-label-md text-on-surface-variant block mb-unit';
  const cardCls = 'bg-surface-container-lowest border border-outline-variant rounded-lg p-6';

  if (!(isEdit ? can('clients.edit') : can('clients.create'))) {
    return <AccessDenied message={isEdit ? "You don't have permission to edit clients." : "You don't have permission to create clients."} />;
  }

  return (
    <div className="space-y-stack-lg">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <div className="flex items-center gap-2 text-on-surface-variant font-body-md text-body-md mb-2">
            <a className="hover:text-primary transition-colors" href="#" onClick={(e) => { e.preventDefault(); navigate(fromInvoice ? '/invoices/new' : '/clients'); }}>Clients</a>
            {isEdit && (
              <>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <a className="hover:text-primary transition-colors" href="#" onClick={(e) => { e.preventDefault(); navigate(`/clients/${id}/edit`); }}>{form.name || 'Client'}</a>
              </>
            )}
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-medium">{isEdit ? 'Edit' : 'Add'}</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary">{isEdit ? 'Edit Client Profile' : 'Add Client Profile'}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {isEdit ? `Update information and account details for ${form.name || 'this client'}.` : 'Enter the details below to onboard a new entity into the CRM.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(fromInvoice ? '/invoices/new' : '/clients')}
            className="px-4 py-2 border border-outline-variant text-primary bg-surface-container-lowest hover:bg-surface-container transition-colors rounded-DEFAULT font-label-md text-label-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="client-form"
            disabled={saving || loading}
            className="px-4 py-2 bg-primary text-white hover:bg-primary-container transition-colors rounded-DEFAULT font-label-md text-label-md disabled:opacity-50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Client'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-stack-md px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">{error}</div>
      )}

      {loading ? (
        <div className="py-16 text-center font-body-md text-body-md text-on-surface-variant">Loading client…</div>
      ) : (
        <form id="client-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
            {/* Main Form Column (8 cols) */}
            <div className="lg:col-span-8 space-y-stack-md">
              {/* Basic Information Card */}
              <section className="cardCls">
                <h3 className="font-headline-md text-headline-md text-primary mb-6 flex items-center gap-2 border-b border-outline-variant pb-4">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="clientType">Assessee Type</label>
                    <select className={selectCls} id="clientType" value={form.client_type} onChange={set('client_type')}>
                      {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="legalName">Name <span className="text-error">*</span></label>
                    <input className={inputCls} id="legalName" placeholder="Enter name as registered" required type="text" value={form.name} onChange={set('name')} />
                  </div>
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className={labelCls} htmlFor="contactPerson">Primary Contact Person</label>
                    <input className={inputCls} id="contactPerson" placeholder="Full name" type="text" value={form.contact_person} onChange={set('contact_person')} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="email">Email Address</label>
                    <input className={inputCls} id="email" placeholder="contact@company.com" type="email" value={form.email} onChange={set('email')} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="phone">Phone Number <span className="text-error">*</span></label>
                    <input className={inputCls} id="phone" placeholder="+91 00000 00000" type="tel" required value={form.phone} onChange={set('phone')} />
                  </div>
                </div>
              </section>

              {/* Billing Address Card */}
              <section className="cardCls">
                <h3 className="font-headline-md text-headline-md text-primary mb-6 flex items-center gap-2 border-b border-outline-variant pb-4">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  Billing Address
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className={labelCls} htmlFor="streetAddress">Street Address</label>
                    <input className={inputCls} id="streetAddress" placeholder="Building, Street, Area" type="text" value={form.address_line1} onChange={set('address_line1')} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="addressLine2">Address Line 2</label>
                    <input className={inputCls} id="addressLine2" placeholder="Suite, Floor, Landmark" type="text" value={form.address_line2} onChange={set('address_line2')} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="city">City</label>
                    <input className={inputCls} id="city" placeholder="City" type="text" value={form.city} onChange={set('city')} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="state">State</label>
                    <select className={selectCls} id="state" value={form.state} onChange={set('state')}>
                      <option value="">Select state</option>
                      {['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="zipCode">ZIP/Postal Code</label>
                    <input className={inputCls} id="zipCode" placeholder="PIN Code" type="text" value={form.pincode} onChange={set('pincode')} maxLength={6} />
                  </div>
                </div>
              </section>

              {/* Tax & Compliance Card */}
              <section className="cardCls">
                <h3 className="font-headline-md text-headline-md text-primary mb-6 flex items-center gap-2 border-b border-outline-variant pb-4">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                  Tax & Compliance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-md">
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="gstin">
                      <span>GSTIN</span>
                      <span className="text-xs font-normal text-on-surface-variant">· 15 digits</span>
                    </label>
                    <input className={monoInputCls} id="gstin" placeholder="e.g. 22AAAAA0000A1Z5" type="text" value={form.gstin} onChange={set('gstin')} maxLength={15} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="pan">
                      <span>PAN</span>
                      <span className="text-xs font-normal text-on-surface-variant">· 10 digits</span>
                    </label>
                    <input className={monoInputCls} id="pan" placeholder="e.g. ABCDE1234F" type="text" value={form.pan} onChange={set('pan')} maxLength={10} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="tan">
                      <span>TAN</span>
                      <span className="text-xs font-normal text-on-surface-variant">· 10 digits</span>
                    </label>
                    <input className={monoInputCls} id="tan" placeholder="e.g. ABCDE1234F" type="text" value={form.tan} onChange={set('tan')} maxLength={10} />
                  </div>
                </div>
              </section>
            </div>

            {/* Secondary Info Column (4 cols) */}
            <div className="lg:col-span-4 space-y-stack-md">
              {/* Management & Services Card */}
              <section className="cardCls">
                <h3 className="font-headline-md text-headline-md text-primary mb-4 border-b border-outline-variant pb-4">Management &amp; Services</h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="managedBy">Managed By</label>
                    <div className="relative">
                      <select className={selectCls} id="managedBy" value={form.assigned_to} onChange={set('assigned_to')}>
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name} ({ROLE_LABELS[m.role] || m.role})</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
                    </div>
                  </div>

                  {/* Services Opted */}
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Services Opted</label>
                    <div className="flex flex-wrap gap-2 p-2 bg-surface-container-low border border-outline-variant rounded-DEFAULT min-h-[42px]">
                      {selectedServices.length === 0 && (
                        <span className="font-body-md text-body-md text-on-surface-variant">None selected</span>
                      )}
                      {selectedServices.map((s) => (
                        <span key={s.id} className="flex items-center gap-1 px-2 py-1 bg-primary text-white rounded-full text-[12px] font-medium">
                          {s.name}
                          <button
                            type="button"
                            className="hover:text-white/70"
                            title="Remove"
                            onClick={() => toggleService(s.id)}
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setServicesOpen((o) => !o)}
                        className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-DEFAULT font-body-md text-body-md text-primary flex justify-between items-center cursor-pointer hover:border-inverse-surface transition-all"
                      >
                        <span>{servicesOpen ? 'Close' : 'Manage services...'}</span>
                        <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
                      </button>
                      {servicesOpen && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
                          {SERVICE_CATEGORY_ORDER.map((cat) => {
                            const catServices = services.filter((s) => s.category === cat);
                            if (!catServices.length) return null;
                            return (
                              <div key={cat}>
                                <div className="p-2 border-b border-outline-variant bg-surface-container-low">
                                  <span className="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">{SERVICE_CATEGORY_LABELS[cat] || cat}</span>
                                </div>
                                {catServices.map((s) => {
                                  const checked = serviceIds.includes(s.id);
                                  return (
                                    <div
                                      key={s.id}
                                      className={`p-2 hover:bg-surface-container cursor-pointer text-body-md flex items-center justify-between ${checked ? 'bg-surface-container-low' : ''}`}
                                      onClick={() => toggleService(s.id)}
                                    >
                                      <span>{s.name}</span>
                                      <span className={`material-symbols-outlined text-[18px] ${checked ? 'text-primary' : 'text-on-surface-variant'}`}>
                                        {checked ? 'check_box' : 'check_box_outline_blank'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                          {services.length === 0 && (
                            <div className="p-4 text-center font-body-md text-body-md text-on-surface-variant">No services found. Add them in Settings → Services.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Client Status Card */}
              <section className="cardCls">
                <h3 className="font-headline-md text-headline-md text-primary mb-4">Client Status</h3>
                <div className="flex flex-col gap-1">
                  <label className={labelCls} htmlFor="status">Status</label>
                  <select className={selectCls} id="status" value={form.status} onChange={set('status')}>
                    {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </section>

              {/* Internal Notes Card */}
              <section className="cardCls">
                <h3 className="font-headline-md text-headline-md text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 0" }}>speaker_notes</span>
                  Internal Notes
                </h3>
                <textarea
                  className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-DEFAULT font-body-md text-body-md text-primary focus:outline-none focus:border-inverse-surface focus:border-2 transition-all resize-none"
                  rows="5"
                  placeholder="Additional notes about this client..."
                  value={form.notes}
                  onChange={set('notes')}
                />
              </section>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
