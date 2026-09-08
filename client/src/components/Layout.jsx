import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../hooks/useSettings.js';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/clients', label: 'Clients', icon: 'group' },
  { to: '/tasks', label: 'Tasks & Compliance', icon: 'task_alt' },
  { label: 'Billing', icon: 'receipt_long' },
  { label: 'Settings', icon: 'settings' },
];

const BILLING_ITEMS = [
  { label: 'Invoices', to: '/invoices' },
  { label: 'Payments', to: '/payments' },
];

const SETTINGS_ITEMS = [
  { label: 'Company Information', to: '/settings' },
  { label: 'Team Members', to: '/settings/team' },
  { label: 'Roles & Permissions', to: '/settings/roles' },
];

const FOOTER_ITEMS = [
  { label: 'Support', icon: 'contact_support' },
  { label: 'Logout', icon: 'logout' },
];

const ACTIVE_CLASSES =
  'text-primary dark:text-secondary-fixed-dim font-bold bg-primary/10 dark:bg-secondary-container rounded-lg font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-primary/15 dark:hover:bg-surface-container shadow-[inset_3px_0_0_#0b6bcb] dark:shadow-none transition-all duration-200 ease-in-out';

const INACTIVE_CLASSES =
  'text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg';

const SUB_ACTIVE_CLASSES =
  'block px-3 py-1.5 rounded-lg text-primary dark:text-secondary-fixed-dim font-bold bg-primary/10 dark:bg-secondary-container/40 border-l-4 border-primary dark:border-secondary-container font-label-md text-label-md';

const SUB_INACTIVE_CLASSES =
  'block px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low dark:hover:bg-surface-container hover:text-on-surface transition-all font-label-md text-label-md';

function FilledIcon({ name, filled = false }) {
  return (
    <span
      className="material-symbols-outlined text-[20px]"
      style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}` }}
    >
      {name}
    </span>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useSettings();
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isBillingActive = location.pathname.startsWith('/invoices') || location.pathname.startsWith('/payments');
  const isBillingExpanded = billingOpen || isBillingActive;

  const isSettingsActive = location.pathname.startsWith('/settings');
  const isSettingsExpanded = settingsOpen || isSettingsActive;

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="bg-background font-body-md text-body-md text-on-background flex h-screen overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SideNavBar */}
      <nav
        className={`bg-surface dark:bg-background border-r border-outline-variant dark:border-outline w-64 h-screen fixed left-0 top-0 z-40 flex flex-col h-full py-stack-md px-4 transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'flex translate-x-0' : '-translate-x-full'
        } md:flex md:translate-x-0`}
      >
        {/* Brand/Header */}
        <div className="mb-stack-lg flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              assured_workload
            </span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-primary break-words leading-tight">
              {settings?.company_name || 'Vyom CRM'}
            </h2>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-grow">
          {NAV_ITEMS.map((item) => {
            if (!item.to) {
              const isBilling = item.label === 'Billing';
              const active = isBilling ? isBillingActive : isSettingsActive;
              const expanded = isBilling ? isBillingExpanded : isSettingsExpanded;
              const subItems = isBilling ? BILLING_ITEMS : SETTINGS_ITEMS;
              const setOpen = isBilling ? setBillingOpen : setSettingsOpen;

              return (
                <div key={item.label} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className={`w-full ${active ? ACTIVE_CLASSES : INACTIVE_CLASSES}`}
                  >
                    <FilledIcon name={item.icon} filled={active} />
                    {item.label}
                    <span
                      className={`material-symbols-outlined text-sm ml-auto transition-transform duration-200 ${
                        expanded ? 'rotate-180' : ''
                      }`}
                    >
                      expand_more
                    </span>
                  </button>
                  {expanded && (
                    <ul className="ml-6 mt-1 space-y-1 mb-1 border-l border-outline-variant dark:border-outline pl-3">
                      {subItems.map((sub) => {
                        const subActive = location.pathname === sub.to;
                        return (
                          <li key={sub.label}>
                            <NavLink
                              to={sub.to}
                              onClick={() => setMobileOpen(false)}
                              className={subActive ? SUB_ACTIVE_CLASSES : SUB_INACTIVE_CLASSES}
                            >
                              {sub.label}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => (isActive ? ACTIVE_CLASSES : INACTIVE_CLASSES)}
              >
                {({ isActive }) => (
                  <>
                    <FilledIcon name={item.icon} filled={isActive} />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Links */}
        <ul className="flex flex-col gap-1 mt-auto pt-stack-md border-t border-outline-variant dark:border-outline">
          {FOOTER_ITEMS.map((item) => (
            <li key={item.label}>
              {item.label === 'Logout' ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`w-full ${INACTIVE_CLASSES}`}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  {item.label}
                </button>
              ) : (
                <a href="#" onClick={(e) => e.preventDefault()} className={INACTIVE_CLASSES}>
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-64 w-full relative h-screen overflow-hidden">
        {/* TopNavBar */}
        <header className="bg-surface-container-lowest dark:bg-inverse-surface border-b border-outline-variant dark:border-outline w-full h-16 sticky top-0 z-30 font-body-md text-body-md text-primary dark:text-primary-fixed flex items-center justify-between px-container-padding">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full mr-2"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>

          <div className="md:hidden font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed mr-auto">
            {settings?.company_name || 'Vyom CRM'}
          </div>

          <div className="hidden md:flex items-center bg-surface-container-low rounded-full px-4 py-2 w-96 border border-transparent focus-within:border-primary transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant mr-2 text-[20px]">
              search
            </span>
            <input
              className="bg-transparent border-none focus:ring-0 w-full text-body-md font-body-md text-on-surface placeholder-on-surface-variant p-0 m-0 outline-none"
              placeholder="Search clients, projects, or invoices..."
              type="text"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              className="relative p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80"
            >
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              <span className="absolute top-1 right-1 bg-error text-on-error text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                5
              </span>
            </button>
            <button
              type="button"
              className="p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80"
            >
              <span className="material-symbols-outlined text-[24px]">help</span>
            </button>
            <div className="h-6 w-[1px] bg-outline-variant mx-2"></div>
            <button
              type="button"
              className="flex items-center gap-2 p-1 pl-2 hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80"
            >
              <span className="font-label-md text-label-md text-on-surface font-semibold hidden lg:block">
                {user?.full_name || 'Profile'}
              </span>
              <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-md text-label-md">
                {(user?.full_name || 'P')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'P'}
              </div>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background p-container-padding">
          <div className="max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
