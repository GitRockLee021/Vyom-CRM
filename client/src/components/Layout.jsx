import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings.js';
import { useSettings } from '../hooks/useSettings.js';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/clients', label: 'Clients', icon: 'group' },
  { to: '/invoices', label: 'Billing', icon: 'receipt_long' },
  { label: 'Settings', icon: 'settings' },
];

const FOOTER_ITEMS = [
  { label: 'Support', icon: 'contact_support' },
  { label: 'Logout', icon: 'logout' },
];

const ACTIVE_CLASSES =
  'text-secondary dark:text-secondary-fixed-dim font-bold bg-secondary-fixed dark:bg-secondary-container rounded-lg font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out';

const INACTIVE_CLASSES =
  'text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg';

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
  const settings = useSettings();

  return (
    <div className="bg-background font-body-md text-body-md text-on-background flex h-screen overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <nav
        className={`bg-surface border-r border-outline-variant w-64 h-screen fixed left-0 top-0 z-40 flex-col py-stack-md px-4 transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'flex translate-x-0' : '-translate-x-full'
        } md:flex md:translate-x-0`}
      >
        <div className="mb-stack-lg flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded bg-primary-container flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-on-primary-container"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              assured_workload
            </span>
          </div>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-primary break-words leading-tight">{settings?.company_name || 'Vyom CRM'}</h2>
          </div>
        </div>

        <ul className="flex flex-col gap-1 flex-grow">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              {item.to ? (
                <NavLink
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
              ) : (
                <a href="#" onClick={(e) => e.preventDefault()} className={INACTIVE_CLASSES}>
                  <FilledIcon name={item.icon} />
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>

        <ul className="flex flex-col gap-1 mt-auto pt-stack-md border-t border-outline-variant">
          {FOOTER_ITEMS.map((item) => (
            <li key={item.label}>
              <a href="#" onClick={(e) => e.preventDefault()} className={INACTIVE_CLASSES}>
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex-1 flex flex-col md:ml-64 w-full relative h-screen overflow-hidden">
        <header className="bg-surface-container-lowest border-b border-outline-variant w-full h-16 sticky top-0 z-30 font-body-md text-body-md text-primary flex items-center justify-between px-container-padding">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full mr-2"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>

          <div className="md:hidden font-headline-md text-headline-md font-bold text-primary mr-auto">
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
                Profile
              </span>
              <img
                alt="User profile avatar"
                className="w-8 h-8 rounded-full object-cover border border-outline-variant"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB1jIf_HSiK-R2jO3o2JucWONqLA7KE0qvbODrUY2MDdOUrBKaNpTMA45SEArezHgClC3m2xd_VEyeTn8nmIOGDtp2v4WWwsgdnpVCm2-Zl-kc8FmM9E180F1AQ6XfbdqeRT8Q796oQIVSFqwxXJvAVHje77XqGLOHwp_z37c9AeBvMiLeC3x_d7Sp33LnwNsPOQg8tRLPVT651a2JY193bSgoz8goplsgxZfH6gHrwyuLN9-yUn74"
              />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background p-container-padding">
          <div className="max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
