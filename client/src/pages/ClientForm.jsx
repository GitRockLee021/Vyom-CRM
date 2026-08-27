import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMockNav } from '../hooks/useMockNav.js';
import { useSettings } from '../hooks/useSettings.js';

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
  status: 'active', notes: '',
};

export default function ClientForm() {
  const navigate = useNavigate();
  const handleNav = useMockNav();
  const settings = useSettings();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clients/${id}`);
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
        });
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
      const res = await fetch(isEdit ? `/api/clients/${id}` : '/api/clients', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      navigate('/clients');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setSaving(false);
    }
  }

  const inputCls = 'w-full border border-outline-variant rounded-DEFAULT p-2 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all';
  const selectCls = `${inputCls} bg-surface-container-lowest`;
  const monoInputCls = `${inputCls} font-data-mono text-data-mono uppercase`;
  const labelCls = 'font-label-md text-label-md text-on-surface block mb-unit';

  return (
    <div className="bg-surface font-body-md text-on-surface h-screen flex overflow-hidden" onClick={handleNav}>
      {/* SideNavBar */}
      <aside className="bg-surface dark:bg-background border-r border-outline-variant dark:border-outline w-64 h-screen fixed left-0 top-0 z-40 flex flex-col h-full py-stack-md px-4 transition-all duration-200 ease-in-out hidden md:flex">
        {/* Brand/Header */}
        <div className="mb-stack-lg flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded bg-primary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>assured_workload</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-primary break-words leading-tight">{settings?.company_name || 'Vyom CRM'}</h2>
          </div>
        </div>
        <nav className="flex flex-col gap-1 flex-grow">
          <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>dashboard</span>
            Dashboard
          </a>
          <a className="text-secondary dark:text-secondary-fixed-dim font-bold bg-secondary-fixed dark:bg-secondary-container rounded-lg font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out" href="#">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>group</span>
            Clients
          </a>
          <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>receipt_long</span>
            Billing
          </a>
          <div className="flex flex-col">
            <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>settings</span>
              Settings
              <span className="material-symbols-outlined text-sm ml-auto">expand_more</span>
            </a>
            <ul className="ml-6 mt-1 space-y-1 mb-1 border-l border-outline-variant dark:border-outline pl-3">
              <li>
                <a className="block px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container hover:text-on-surface transition-all font-label-md text-label-md" href="#">
                  Company Information
                </a>
              </li>
              <li>
                <a className="block px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container hover:text-on-surface transition-all font-label-md text-label-md" href="#">
                  Roles &amp; Permissions
                </a>
              </li>
            </ul>
          </div>
        </nav>
        {/* Footer Links */}
        <ul className="flex flex-col gap-1 mt-auto pt-stack-md border-t border-outline-variant dark:border-outline">
          <li>
            <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>contact_support</span>
              Support
            </a>
          </li>
          <li>
            <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>logout</span>
              Logout
            </a>
          </li>
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:ml-64 w-full relative h-screen overflow-hidden">
        {/* TopNavBar */}
        <header className="bg-surface-container-lowest dark:bg-inverse-surface border-b border-outline-variant dark:border-outline w-full h-16 sticky top-0 z-30 font-body-md text-body-md text-primary dark:text-primary-fixed flex items-center justify-between px-container-padding">
          <button type="button" className="md:hidden p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full mr-2">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="md:hidden font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed mr-auto">
            {settings?.company_name || 'Vyom CRM'}
          </div>
          <div className="hidden md:flex items-center bg-surface-container-low rounded-full px-4 py-2 w-96 border border-transparent focus-within:border-primary transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant mr-2 text-[20px]">search</span>
            <input className="bg-transparent border-none focus:ring-0 w-full text-body-md font-body-md text-on-surface placeholder-on-surface-variant p-0 m-0 outline-none" placeholder="Search clients, projects, or invoices..." type="text" />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button type="button" className="relative p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80 transition-all">
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              <span className="absolute top-1 right-1 bg-error text-on-error text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">5</span>
            </button>
            <button type="button" className="p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80 transition-all">
              <span className="material-symbols-outlined text-[24px]">help</span>
            </button>
            <div className="h-6 w-[1px] bg-outline-variant mx-2"></div>
            <button type="button" className="flex items-center gap-2 p-1 pl-2 hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80 transition-all">
              <span className="font-label-md text-label-md text-on-surface font-semibold hidden lg:block">Profile</span>
              <img alt="User profile avatar" className="w-8 h-8 rounded-full object-cover border border-outline-variant" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD6JU0IdWSZ7-CjN638O-WcW2BmfgiG5tdXzTH__XGaKHzEXizpDaWTlYRWlw-vnPLhfyL1Nds2rOLQkuW-oKi5AsDSAjNw9A23JdslOl6ok5RVpBEJktRqYBkG-FuXSpUEK76KwXXg5_O8BGT9cVBvExeB8sRQIt-RGZhGmgcsTKlVpymeWgiLfkQv6lXQ0UDXvKrv0nL3C1AchdCMgzX6nUky5Y2y5FnjyOJ0nfstXBJag2MNwEs" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-container-padding bg-background">
          <div className="max-w-[1440px] mx-auto">
            {/* Page Header & Actions */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-outline-variant py-stack-md mb-stack-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <nav aria-label="Breadcrumb" className="flex text-on-surface-variant font-label-md text-label-md mb-2">
                  <ol className="flex items-center space-x-2">
                    <li><a className="hover:text-primary transition-colors" href="#" onClick={(e) => { e.preventDefault(); navigate('/clients'); }}>Clients</a></li>
                    <li><span className="material-symbols-outlined text-sm">chevron_right</span></li>
                    <li aria-current="page" className="text-primary">{isEdit ? 'Edit Client' : 'Add New Client'}</li>
                  </ol>
                </nav>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">{isEdit ? 'Edit Client' : 'Add New Client'}</h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">{isEdit ? 'Updating client record' : 'Enter the details below to onboard a new entity into the CRM.'}</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => navigate('/clients')} className="bg-surface-container-lowest border border-outline-variant text-on-surface font-label-md text-label-md py-2 px-6 rounded-DEFAULT hover:bg-surface-container transition-colors focus:ring-2 focus:ring-outline-variant outline-none">
                  Cancel
                </button>
                <button type="submit" form="client-form" disabled={saving || loading} className="bg-primary text-on-primary font-label-md text-label-md py-2 px-6 rounded-DEFAULT hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm focus:ring-2 focus:ring-primary outline-none flex items-center gap-2 disabled:opacity-50">
                  <span className="material-symbols-outlined text-sm">save</span>
                  {saving ? 'Saving…' : isEdit ? 'Update Client' : 'Save Client'}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-stack-md px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">{error}</div>
            )}

            {loading ? (
              <div className="py-16 text-center font-body-md text-body-md text-on-surface-variant">Loading client…</div>
            ) : (
              <form id="client-form" onSubmit={handleSubmit} className="space-y-2">
                {/* Section 1: Basic Information */}
                <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-sm">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-stack-md flex items-center gap-2 border-b border-surface-variant pb-3">
                    <span className="material-symbols-outlined text-primary">corporate_fare</span>
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className={labelCls} htmlFor="clientType">Assessee Type</label>
                      <select className={selectCls} id="clientType" value={form.client_type} onChange={set('client_type')}>
                        {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="legalName">Name <span className="text-error">*</span> <span className="font-normal text-on-surface-variant">(as per PAN/GSTIN)</span></label>
                      <input className={inputCls} id="legalName" placeholder="Enter name as registered" required type="text" value={form.name} onChange={set('name')} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="contactPerson">Primary Contact Person</label>
                      <input className={inputCls} id="contactPerson" placeholder="Full name" type="text" value={form.contact_person} onChange={set('contact_person')} />
                    </div>
                  </div>
                </section>

                {/* Section 2: Contact Details */}
                <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-sm">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-stack-md flex items-center gap-2 border-b border-surface-variant pb-3">
                    <span className="material-symbols-outlined text-primary">contacts</span>
                    Contact Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls} htmlFor="email">Email Address</label>
                      <input className={inputCls} id="email" placeholder="contact@company.com" type="email" value={form.email} onChange={set('email')} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="phone">Phone Number <span className="text-error">*</span></label>
                      <input className={inputCls} id="phone" placeholder="+91 00000 00000" type="tel" required value={form.phone} onChange={set('phone')} />
                    </div>
                  </div>
                </section>

                {/* Section 3: Billing Address */}
                <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-sm">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-stack-md flex items-center gap-2 border-b border-surface-variant pb-3">
                    <span className="material-symbols-outlined text-primary">location_on</span>
                    Billing Address
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-6">
                      <label className={labelCls} htmlFor="streetAddress">Street Address</label>
                      <input className={inputCls} id="streetAddress" placeholder="Building, Street, Area" type="text" value={form.address_line1} onChange={set('address_line1')} />
                    </div>
                    <div className="md:col-span-3">
                      <label className={labelCls} htmlFor="addressLine2">Address Line 2</label>
                      <input className={inputCls} id="addressLine2" placeholder="Suite, Floor, Landmark" type="text" value={form.address_line2} onChange={set('address_line2')} />
                    </div>
                    <div className="md:col-span-3">
                      <label className={labelCls} htmlFor="city">City</label>
                      <input className={inputCls} id="city" placeholder="City" type="text" value={form.city} onChange={set('city')} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls} htmlFor="state">State</label>
                      <select className={inputCls} id="state" value={form.state} onChange={set('state')}>
                        <option value="">Select state</option>
                        {['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls} htmlFor="zipCode">ZIP/Postal Code</label>
                      <input className={inputCls} id="zipCode" placeholder="PIN Code" type="text" value={form.pincode} onChange={set('pincode')} maxLength={6} />
                    </div>
                  </div>
                </section>

                {/* Section 4: Tax & Compliance */}
                <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container"></div>
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-stack-md flex items-center gap-2 border-b border-surface-variant pb-3 pl-2">
                    <span className="material-symbols-outlined text-primary">verified_user</span>
                    Tax & Compliance
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-2">
                    <div>
                      <label className="font-label-md text-label-md text-on-surface block mb-unit flex items-center justify-between" htmlFor="gstin">
                        <span>GSTIN</span>
                        <span className="text-xs font-normal text-on-surface-variant">15-digit alphanumeric</span>
                      </label>
                      <input className={monoInputCls} id="gstin" placeholder="e.g. 22AAAAA0000A1Z5" type="text" value={form.gstin} onChange={set('gstin')} maxLength={15} />
                    </div>
                    <div>
                      <label className="font-label-md text-label-md text-on-surface block mb-unit flex items-center justify-between" htmlFor="pan">
                        <span>PAN</span>
                        <span className="text-xs font-normal text-on-surface-variant">10-digit alphanumeric</span>
                      </label>
                      <input className={monoInputCls} id="pan" placeholder="e.g. ABCDE1234F" type="text" value={form.pan} onChange={set('pan')} maxLength={10} />
                    </div>
                    <div>
                      <label className="font-label-md text-label-md text-on-surface block mb-unit flex items-center justify-between" htmlFor="tan">
                        <span>TAN</span>
                        <span className="text-xs font-normal text-on-surface-variant">10-digit alphanumeric</span>
                      </label>
                      <input className={monoInputCls} id="tan" placeholder="e.g. ABCDE1234F" type="text" value={form.tan} onChange={set('tan')} maxLength={10} />
                    </div>
                  </div>
                </section>

                {/* Section 5: Status & Notes */}
                <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-sm">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-stack-md flex items-center gap-2 border-b border-surface-variant pb-3">
                    <span className="material-symbols-outlined text-primary">flag</span>
                    Status & Notes
                  </h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className={labelCls} htmlFor="status">Status</label>
                      <select className={selectCls} id="status" value={form.status} onChange={set('status')}>
                        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls} htmlFor="notes">Notes</label>
                      <textarea className={`${inputCls} h-24 resize-none`} id="notes" placeholder="Additional notes about this client..." value={form.notes} onChange={set('notes')} />
                    </div>
                  </div>
                </section>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
