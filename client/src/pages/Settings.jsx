import { useEffect, useRef, useState } from 'react';
import { useMockNav } from '../hooks/useMockNav.js';
import { useSettings } from '../hooks/useSettings.js';

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
  const handleNav = useMockNav();
  const settings = useSettings();
  const [form, setForm] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const logoRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings');
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
        headers: { 'Content-Type': 'application/json' },
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
    <div className="bg-surface font-body-md text-on-surface h-screen flex overflow-hidden" onClick={handleNav}>
      {/* SideNavBar */}
      <aside className="bg-surface dark:bg-background border-r border-outline-variant dark:border-outline w-64 h-screen fixed left-0 top-0 z-40 flex flex-col h-full py-stack-md px-4 transition-all duration-200 ease-in-out hidden md:flex">
        <div className="mb-stack-lg flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded bg-primary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>assured_workload</span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-primary break-words leading-tight">{settings?.company_name || 'FinConsult CRM'}</h2>
          </div>
        </div>
        <nav className="flex flex-col gap-1 flex-grow">
          <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>dashboard</span>
            Dashboard
          </a>
          <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>group</span>
            Clients
          </a>
          <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>receipt_long</span>
            Billing
          </a>
          <div className="flex flex-col">
            <a className="text-secondary dark:text-secondary-fixed-dim font-bold bg-secondary-fixed dark:bg-secondary-container rounded-lg font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out" href="#">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>settings</span>
              Settings
              <span className="material-symbols-outlined text-sm ml-auto">expand_more</span>
            </a>
            <ul className="ml-6 mt-1 space-y-1 mb-1 border-l border-outline-variant dark:border-outline pl-3">
              <li>
                <a className="block px-3 py-1.5 rounded-lg text-primary font-bold bg-secondary-fixed/30 dark:bg-secondary-container/40 border-r-4 border-primary font-label-md text-label-md" href="#">
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
            {settings?.company_name || 'FinConsult CRM'}
          </div>
          <div className="hidden md:flex items-center bg-surface-container-low rounded-full px-4 py-2 w-96 border border-transparent focus-within:border-primary transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant mr-2 text-[20px]">search</span>
            <input className="bg-transparent border-none focus:ring-0 w-full text-body-md font-body-md text-on-surface placeholder-on-surface-variant p-0 m-0 outline-none" placeholder="Search settings..." type="text" />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button type="button" className="relative p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80 transition-all">
              <span className="material-symbols-outlined text-[24px]">notifications</span>
            </button>
            <button type="button" className="p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80 transition-all">
              <span className="material-symbols-outlined text-[24px]">help</span>
            </button>
            <div className="h-6 w-[1px] bg-outline-variant mx-2" />
            <button type="button" className="flex items-center gap-2 p-1 pl-2 hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80 transition-all">
              <span className="font-label-md text-label-md text-on-surface font-semibold hidden lg:block">Profile</span>
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">person</span>
              </div>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
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
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      {saving ? 'Saving…' : 'Save Company Settings'}
                    </button>
                  </div>
                </form>
              )}
            </section>

            <div className="h-8" />
          </div>
        </div>
      </main>
    </div>
  );
}
