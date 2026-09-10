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

const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </>
  ),
  group: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  task_alt: (
    <>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  receipt_long: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  settings: (
    <>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </>
  ),
  contact_support: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  assured_workload: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </>
  ),
  chevron: <polyline points="6 9 12 15 18 9" />,
  menu: (
    <>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  notifications: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
};

function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {ICONS[name] || null}
    </svg>
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
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            <Icon name="assured_workload" size={24} className="text-primary" />
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
                    <Icon name={item.icon} />
                    {item.label}
                    <Icon
                      name="chevron"
                      size={18}
                      className={`ml-auto transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                    />
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
                    <Icon name={item.icon} />
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
                  <Icon name={item.icon} />
                  {item.label}
                </button>
              ) : (
                <a href="#" onClick={(e) => e.preventDefault()} className={INACTIVE_CLASSES}>
                  <Icon name={item.icon} />
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
            <Icon name="menu" className="text-on-surface-variant" />
          </button>

          <div className="md:hidden font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed mr-auto">
            {settings?.company_name || 'Vyom CRM'}
          </div>

          <div className="hidden md:flex items-center bg-surface-container-low rounded-full px-4 py-2 w-96 border border-transparent focus-within:border-primary transition-colors">
            <Icon name="search" size={20} className="text-on-surface-variant mr-2" />
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
              <Icon name="notifications" size={24} className="text-on-surface-variant" />
              <span className="absolute top-1 right-1 bg-error text-on-error text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                5
              </span>
            </button>
            <button
              type="button"
              className="p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full cursor-pointer active:opacity-80"
            >
              <Icon name="help" size={24} className="text-on-surface-variant" />
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
