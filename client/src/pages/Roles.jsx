import { useEffect, useState } from 'react';
import { useMockNav } from '../hooks/useMockNav.js';
import { usePerm } from '../hooks/usePerm.js';
import { useSettings } from '../hooks/useSettings.js';
import { useFetch } from '../hooks/useFetch.js';
import { authHeaders } from '../utils/authHeader.js';

const PERMISSION_MODULES = [
  {
    key: 'clients',
    title: 'Client Management',
    icon: 'group',
    permissions: [
      { key: 'view', label: 'View Clients', desc: 'Read access to client profiles.' },
      { key: 'create', label: 'Create Clients', desc: 'Add new client records.' },
      { key: 'edit', label: 'Edit Clients', desc: 'Modify existing client data.' },
      { key: 'delete', label: 'Delete Clients', desc: 'Permanently remove records.', danger: true },
    ],
  },
  {
    key: 'billing',
    title: 'Billing & Invoices',
    icon: 'receipt_long',
    permissions: [
      { key: 'view', label: 'View Invoices', desc: 'Read access to invoice records.' },
      { key: 'create', label: 'Create Invoices', desc: 'Issue new invoice records.' },
      { key: 'edit', label: 'Edit Invoices', desc: 'Modify existing invoice data.' },
      { key: 'delete', label: 'Delete Invoices', desc: 'Permanently remove invoice records.', danger: true },
      { key: 'record_payment', label: 'Record Payments', desc: 'Apply and track payments.' },
    ],
  },
  {
    key: 'engagements',
    title: 'Engagements & Work',
    icon: 'task_alt',
    permissions: [
      { key: 'view', label: 'View Engagements', desc: 'Read access to engagements, tasks and services.' },
      { key: 'create', label: 'Create Engagements', desc: 'Create engagements, tasks and services.' },
      { key: 'edit', label: 'Edit Engagements', desc: 'Modify engagements, tasks and services.' },
      { key: 'delete', label: 'Delete Engagements', desc: 'Permanently remove engagements, tasks and services.', danger: true },
    ],
  },
  {
    key: 'settings',
    title: 'Settings & Roles',
    icon: 'settings',
    permissions: [
      { key: 'view', label: 'View Settings', desc: 'Read company configuration.' },
      { key: 'edit', label: 'Edit Settings', desc: 'Modify company details.' },
      { key: 'manage_roles', label: 'Manage Roles', desc: 'Create and edit roles & permissions.' },
    ],
  },
];

const EMPTY_ROLE = { name: '', description: '' };

const inputCls = 'w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg focus:border-primary focus:ring-1 focus:ring-primary font-body-md text-body-md text-on-surface outline-none';
const labelCls = 'block font-label-md text-label-md text-on-surface-variant mb-1 uppercase';

function Toggle({ checked, onChange, disabled, danger }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div
        className={`w-9 h-5 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        } ${danger ? 'peer-checked:bg-error' : 'peer-checked:bg-primary'}`}
      />
    </label>
  );
}

export default function Roles() {
  const handleNav = useMockNav();
  const settings = useSettings();
  const can = usePerm();
  const canManageRoles = can('settings.manage_roles');
  const { data: roles, loading, reload } = useFetch('/roles');
  const [selectedId, setSelectedId] = useState(null);
  const [perms, setPerms] = useState({});
  const [savedPerms, setSavedPerms] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'add' | 'edit', role }
  const [draft, setDraft] = useState(EMPTY_ROLE);

  useEffect(() => {
    if (!roles) return;
    if (!selectedId || !roles.some((r) => r.id === selectedId)) {
      setSelectedId(roles[0]?.id ?? null);
    }
  }, [roles]);

  useEffect(() => {
    const role = (roles || []).find((r) => r.id === selectedId);
    if (!role) return;
    setPerms(JSON.parse(JSON.stringify(role.permissions || {})));
    setSavedPerms(JSON.parse(JSON.stringify(role.permissions || {})));
  }, [selectedId, roles]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const selectedRole = (roles || []).find((r) => r.id === selectedId);
  const activeCount = (roles || []).length;

  function setPerm(moduleKey, permKey, value) {
    setPerms((prev) => ({
      ...prev,
      [moduleKey]: { ...(prev[moduleKey] || {}), [permKey]: value },
    }));
  }

  const hasChanges = JSON.stringify(perms) !== JSON.stringify(savedPerms);

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${selectedId}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ permissions: perms }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setSavedPerms(JSON.parse(JSON.stringify(perms)));
      reload();
      setNotice('Permissions saved.');
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setPerms(JSON.parse(JSON.stringify(savedPerms)));
  }

  function openAdd() {
    setDraft(EMPTY_ROLE);
    setModal({ mode: 'add' });
  }

  function openEdit(role) {
    setDraft({ name: role.name, description: role.description });
    setModal({ mode: 'edit', role });
  }

  async function handleModalSave() {
    if (!draft.name.trim()) {
      setNotice('Role name is required.');
      return;
    }
    try {
      if (modal.mode === 'add') {
        const res = await fetch('/api/roles', {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            name: draft.name.trim(),
            description: draft.description.trim(),
            permissions: {
              clients: { view: false, create: false, edit: false, delete: false },
              billing: { view: false, create: false, edit: false, delete: false, record_payment: false },
              engagements: { view: false, create: false, edit: false, delete: false },
              settings: { view: false, edit: false, manage_roles: false },
            },
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
        reload();
        setSelectedId(data.id);
        setNotice('Role created.');
      } else {
        const res = await fetch(`/api/roles/${modal.role.id}`, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ name: draft.name.trim(), description: draft.description.trim() }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
        reload();
        setNotice('Role updated.');
      }
      setModal(null);
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function handleDelete(role) {
    if (role.is_default) return;
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      reload();
      setSelectedId(null);
      setNotice('Role deleted.');
    } catch (err) {
      setNotice(err.message);
    }
  }

  const modalOpen = Boolean(modal);

  return (
    <div className="bg-surface font-body-md text-on-surface h-screen flex overflow-hidden" onClick={handleNav}>
      {/* SideNavBar */}
      <aside className="bg-surface dark:bg-background border-r border-outline-variant dark:border-outline w-64 h-screen fixed left-0 top-0 z-40 flex flex-col h-full py-stack-md px-4 transition-all duration-200 ease-in-out hidden md:flex">
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
                <a className="block px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container hover:text-on-surface transition-all font-label-md text-label-md" href="#">
                  Company Information
                </a>
              </li>
              <li>
                <a className="block px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container hover:text-on-surface transition-all font-label-md text-label-md" href="#">
                  Team Members
                </a>
              </li>
              <li>
                <a className="block px-3 py-1.5 rounded-lg text-primary font-bold bg-secondary-fixed/30 dark:bg-secondary-container/40 border-r-4 border-primary font-label-md text-label-md" href="#">
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
            {settings?.company_name || 'Vyom CRM'}
          </div>
          <div className="hidden md:flex items-center bg-surface-container-low rounded-full px-4 py-2 w-96 border border-transparent focus-within:border-primary transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant mr-2 text-[20px]">search</span>
            <input className="bg-transparent border-none focus:ring-0 w-full text-body-md font-body-md text-on-surface placeholder-on-surface-variant p-0 m-0 outline-none" placeholder="Search roles or settings..." type="text" />
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
          <div className="max-w-[1440px] mx-auto">
            {notice && (
              <div className="mb-stack-md px-4 py-3 rounded-lg bg-primary-fixed/40 border border-outline-variant font-body-md text-body-md text-on-surface flex items-center justify-between">
                <span>{notice}</span>
                <button type="button" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface" onClick={() => setNotice('')}>Dismiss</button>
              </div>
            )}

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-stack-lg gap-4">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Roles &amp; Permissions</h2>
                <p className="font-body-lg text-body-lg text-on-surface-variant">Manage user access levels and system permissions.</p>
              </div>
              {canManageRoles && (
                <button type="button" onClick={openAdd} className="flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md px-5 py-2.5 rounded-lg hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm self-start sm:self-auto border border-transparent whitespace-nowrap">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
                  Add New Role
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
              {/* Roles Table Container */}
              <div className="lg:col-span-5 flex flex-col gap-stack-md">
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden flex-1 flex flex-col">
                  <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
                    <h3 className="font-headline-md text-headline-md text-on-surface">Available Roles</h3>
                    <span className="bg-secondary-fixed text-on-secondary-fixed font-label-md text-[10px] px-2 py-1 rounded-full">{loading ? '—' : `${activeCount} Active`}</span>
                  </div>
                  {loading ? (
                    <div className="p-6 text-on-surface-variant">Loading roles…</div>
                  ) : !roles.length ? (
                    <div className="p-6 text-on-surface-variant">No roles found.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-surface border-b border-outline-variant font-label-md text-label-md text-on-surface-variant">
                            <th className="px-5 py-3 font-semibold">Role Name</th>
                            <th className="px-5 py-3 font-semibold hidden sm:table-cell">Users</th>
                            <th className="px-5 py-3 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="font-body-md text-body-md">
                          {roles.map((role) => {
                            const isSelected = role.id === selectedId;
                            return (
                              <tr
                                key={role.id}
                                onClick={() => setSelectedId(role.id)}
                                className={`border-b border-outline-variant hover:bg-surface cursor-pointer transition-colors ${isSelected ? 'bg-primary-fixed/25' : ''}`}
                              >
                                <td className="px-5 py-4">
                                  <div className="font-medium text-on-surface flex items-center gap-2">
                                    {role.name}
                                    {role.is_default && <span className="material-symbols-outlined text-primary text-sm" title="System Default Role">verified</span>}
                                  </div>
                                  <div className="text-xs text-on-surface-variant mt-0.5">{role.description || '—'}</div>
                                </td>
                                <td className="px-5 py-4 hidden sm:table-cell text-on-surface-variant">{role.user_count}</td>
                                <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                  {canManageRoles && (
                                  <button type="button" className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors p-1" onClick={() => openEdit(role)}>edit</button>
                                )}
                                {canManageRoles && !role.is_default && (
                                  <button type="button" className="material-symbols-outlined text-on-surface-variant hover:text-error transition-colors p-1" onClick={() => handleDelete(role)}>delete</button>
                                )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Permissions Matrix */}
              <div className="lg:col-span-7">
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden h-full flex flex-col">
                  <div className="px-6 py-5 border-b border-outline-variant bg-surface-container-low flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-headline-md text-headline-md text-on-surface">Permissions: {selectedRole?.name || 'Select a role'}</h3>
                        {selectedRole?.is_default && <span className="material-symbols-outlined text-primary text-sm" title="System Default Role">verified</span>}
                      </div>
                      <p className="font-body-md text-body-md text-on-surface-variant">Configure access levels for this role across system modules.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button type="button" onClick={handleReset} disabled={!hasChanges} className="flex-1 sm:flex-none px-4 py-2 bg-surface text-on-surface border border-outline-variant rounded-lg font-label-md text-label-md hover:bg-surface-container-highest transition-colors disabled:opacity-50">
                        Reset
                      </button>
                      {canManageRoles && (
                      <button type="button" onClick={handleSave} disabled={!selectedRole || !hasChanges || saving} className="flex-1 sm:flex-none px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    )}
                    </div>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1 bg-surface-container-lowest">
                    {!selectedRole ? (
                      <div className="text-on-surface-variant">Select a role to configure its permissions.</div>
                    ) : (
                      PERMISSION_MODULES.map((module) => (
                        <div key={module.key} className="mb-stack-lg last:mb-0">
                          <div className="flex items-center gap-3 mb-4 pb-2 border-b border-outline-variant/50">
                            <span className="material-symbols-outlined text-primary p-2 bg-primary-fixed/40 rounded-lg">{module.icon}</span>
                            <h4 className="font-headline-md text-headline-md text-on-surface text-base">{module.title}</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {module.permissions.map((permission) => (
                              <div key={permission.key} className="flex items-center justify-between p-3 border border-outline-variant rounded-lg bg-surface hover:border-primary/50 transition-colors">
                                <div className="flex flex-col">
                                  <span className={`font-data-mono text-data-mono text-on-surface ${permission.danger ? 'text-error' : ''}`}>{permission.label}</span>
                                  <span className="text-[11px] text-on-surface-variant">{permission.desc}</span>
                                </div>
                                <Toggle
                                  checked={perms?.[module.key]?.[permission.key]}
                                  danger={permission.danger}
                                  onChange={(v) => setPerm(module.key, permission.key, v)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add / Edit Role Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { e.stopPropagation(); }}>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant w-full max-w-md shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h3 className="font-headline-md text-headline-md text-on-surface">{modal.mode === 'add' ? 'Add New Role' : 'Edit Role'}</h3>
              <button type="button" className="text-on-surface-variant hover:text-on-surface transition-colors p-1" onClick={() => setModal(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={labelCls}>Role Name</label>
                <input className={inputCls} type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Tax Consultant" />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <input className={inputCls} type="text" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="e.g. Full Access" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low flex justify-end gap-2">
              <button type="button" className="px-4 py-2 bg-surface text-on-surface border border-outline-variant rounded-lg font-label-md text-label-md hover:bg-surface-container-highest transition-colors" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button type="button" className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm" onClick={handleModalSave}>
                {modal.mode === 'add' ? 'Create Role' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}