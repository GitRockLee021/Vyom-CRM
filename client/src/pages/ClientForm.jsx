import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePerm } from '../hooks/usePerm.js';
import { useTeam } from '../hooks/useTeam.js';
import { useServices } from '../hooks/useServices.js';
import AccessDenied from '../components/AccessDenied.jsx';
import { authHeaders } from '../utils/authHeader.js';
import ServicesOpted, { servicePlan } from '../components/ServicesOpted.jsx';

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

export default function ClientForm({ quick = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fromInvoice = Boolean(location.state?.fromInvoice);
  const can = usePerm();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const isQuick = quick && !isEdit;
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const teamData = useTeam();
  const services = useServices();
  const members = Array.isArray(teamData?.members) ? teamData.members.filter((m) => m.is_active) : [];
  const [serviceIds, setServiceIds] = useState([]);
  const [moreOpen, setMoreOpen] = useState(false);

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
  const isIndividual = form.client_type === 'individual';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!serviceIds.length) { setError('Select at least one service.'); return; }
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
      navigate(fromInvoice ? '/invoices/new' : '/clients', { state: { notice: isEdit ? 'Client updated successfully.' : 'Client created successfully.' } });
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all';
  const selectCls = `${inputCls} cursor-pointer appearance-none bg-surface-container-lowest`;
  const monoInputCls = `${inputCls} font-data-mono text-data-mono uppercase`;
  const labelCls = 'font-label-md text-label-md text-on-surface-variant block mb-unit';
  const cardCls = 'bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card p-6';

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
            <span className="text-primary font-medium">{isQuick ? 'Quick Add Client' : isEdit ? 'Edit' : 'Add'}</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-background">{isQuick ? 'Quick Add Client' : isEdit ? 'Edit Client Profile' : 'Add Client Profile'}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {isEdit
              ? `Update information and account details for ${form.name || 'this client'}.`
              : isQuick
                ? 'Name, phone and the services they have opted into — filing tasks follow automatically.'
                : 'Enter the details below to onboard a new entity into the CRM.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isEdit && (
            <button
              type="button"
              onClick={() => navigate(isQuick ? '/clients/new' : '/clients/new/quick', { state: location.state })}
              className="px-4 py-2 border border-outline-variant text-primary bg-surface-container-lowest hover:bg-surface-container transition-colors rounded-DEFAULT font-label-md text-label-md flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">{isQuick ? 'add' : 'bolt'}</span>
              {isQuick ? 'Full Add Client' : 'Quick Add'}
            </button>
          )}
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
        {isQuick ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter items-start">
            {/* Main Form Column (7 cols) */}
            <div className="xl:col-span-7 space-y-stack-md">
              {/* Basic Information Card */}
              <section className={cardCls}>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-2 border-b border-outline-variant pb-4">
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
                    <label className={labelCls} htmlFor="legalName">{isIndividual ? 'Name' : 'Business Name'} <span className="text-error">*</span></label>
                    <input className={inputCls} id="legalName" placeholder={isIndividual ? 'Full name as per PAN' : 'Business name as per registration'} required type="text" value={form.name} onChange={set('name')} />
                  </div>
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className={labelCls} htmlFor="phone">Phone Number <span className="text-error">*</span></label>
                    <input className={inputCls} id="phone" placeholder="+91 00000 00000" type="tel" required value={form.phone} onChange={set('phone')} />
                  </div>
                </div>

                {/* Services Opted */}
                <div className="flex flex-col gap-1 mt-5">
                  <label className={labelCls}>Services Opted <span className="text-error">*</span></label>
                  <ServicesOpted services={services} selectedIds={serviceIds} onChange={toggleService} />
                </div>
              </section>

              {/* Add More Details Card (collapsible) */}
              <section className={cardCls}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((o) => !o)}
                  className="w-full flex items-center justify-between font-label-md text-label-md text-primary hover:opacity-80 transition-opacity"
                >
                  <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">unfold_more</span> Add more details (email, address, notes, status)</span>
                  <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {moreOpen && (
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-stack-md border-t border-outline-variant pt-5">
                    <div className="flex flex-col gap-1">
                      <label className={labelCls} htmlFor="email">Email Address</label>
                      <input className={inputCls} id="email" placeholder="contact@company.com" type="email" value={form.email} onChange={set('email')} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className={labelCls} htmlFor="contactPerson">Contact Person</label>
                      <input className={inputCls} id="contactPerson" placeholder="Full name" type="text" value={form.contact_person} onChange={set('contact_person')} />
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
                      <label className={labelCls} htmlFor="status">Status</label>
                      <select className={selectCls} id="status" value={form.status} onChange={set('status')}>
                        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className={labelCls} htmlFor="notes">Notes</label>
                      <textarea className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-DEFAULT font-body-md text-body-md text-primary focus:outline-none focus:border-inverse-surface focus:border-2 transition-all resize-none" rows="3" id="notes" placeholder="Additional notes about this client..." value={form.notes} onChange={set('notes')} />
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Task Preview Column (5 cols) */}
            <div className="xl:col-span-5">
              <section className={`${cardCls} xl:sticky xl:top-6`}>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-5 flex items-center gap-2 border-b border-outline-variant pb-4">
                  <span className="material-symbols-outlined text-green-700" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  Will be created
                </h3>
                {selectedServices.length === 0 ? (
                  <p className="font-body-md text-body-md text-on-surface-variant py-6 text-center">
                    Pick a service to see the filing tasks that follow it.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-outline-variant">
                    {selectedServices.map((s) => {
                      const plan = servicePlan(s);
                      return (
                        <li key={s.id} className="py-3 flex items-start gap-3">
                          <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0" style={{ background: plan.color }} />
                          <div>
                            <div className="font-body-md text-body-md font-medium text-on-surface">{plan.label}</div>
                            <div className="font-body-sm text-body-sm text-on-surface-variant">{plan.rule}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
            {/* Main Form Column (8 cols) */}
            <div className="lg:col-span-8 space-y-stack-md">
              {/* Basic Information Card */}
              <section className={cardCls}>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-2 border-b border-outline-variant pb-4">
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
                    <label className={labelCls} htmlFor="legalName">{isIndividual ? 'Name' : 'Business Name'} <span className="text-error">*</span></label>
                    <input className={inputCls} id="legalName" placeholder={isIndividual ? 'Full name as per PAN' : 'Business name as per registration'} required type="text" value={form.name} onChange={set('name')} />
                  </div>
                  {isIndividual ? (
                    <div className="flex flex-col gap-1">
                      <label className={labelCls} htmlFor="email">Email Address</label>
                      <input className={inputCls} id="email" placeholder="contact@company.com" type="email" value={form.email} onChange={set('email')} />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <label className={labelCls} htmlFor="contactPerson">Primary Contact Person</label>
                      <input className={inputCls} id="contactPerson" placeholder="Full name" type="text" value={form.contact_person} onChange={set('contact_person')} />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <label className={labelCls} htmlFor="phone">Phone Number <span className="text-error">*</span></label>
                    <input className={inputCls} id="phone" placeholder="+91 00000 00000" type="tel" required value={form.phone} onChange={set('phone')} />
                  </div>
                  {isIndividual ? (
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className={labelCls}>Services Opted <span className="text-error">*</span></label>
                      <ServicesOpted services={services} selectedIds={serviceIds} onChange={toggleService} />
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1">
                        <label className={labelCls} htmlFor="email">Email Address</label>
                        <input className={inputCls} id="email" placeholder="contact@company.com" type="email" value={form.email} onChange={set('email')} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className={labelCls}>Services Opted <span className="text-error">*</span></label>
                        <ServicesOpted services={services} selectedIds={serviceIds} onChange={toggleService} />
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* Billing Address Card */}
              <section className={cardCls}>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-2 border-b border-outline-variant pb-4">
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
              <section className={cardCls}>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-2 border-b border-outline-variant pb-4">
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
              {/* Management Card */}
              <section className={cardCls}>
                <h3 className="font-headline-md text-headline-md text-primary mb-4 border-b border-outline-variant pb-4">Management</h3>
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
                </div>
              </section>

              {/* Client Status Card */}
              <section className={cardCls}>
                <h3 className="font-headline-md text-headline-md text-primary mb-4">Client Status</h3>
                <div className="flex flex-col gap-1">
                  <label className={labelCls} htmlFor="status">Status</label>
                  <select className={selectCls} id="status" value={form.status} onChange={set('status')}>
                    {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </section>

              {/* Internal Notes Card */}
              <section className={cardCls}>
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
        )}
      </form>
      )}
    </div>
  );
}
