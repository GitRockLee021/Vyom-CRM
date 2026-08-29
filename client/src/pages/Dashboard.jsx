import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { useMockNav } from '../hooks/useMockNav.js';
import { usePerm } from '../hooks/usePerm.js';
import { useSettings } from '../hooks/useSettings.js';
import { useAuth } from '../context/AuthContext.jsx';

function fmtCurrency(n, symbol = '₹') {
  const num = Number(n) || 0;
  return `${symbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCompact(n) {
  const num = Number(n) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}k`;
  return fmtCurrency(num);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const handleNav = useMockNav();
  const settings = useSettings();
  const can = usePerm();
  const { logout, user } = useAuth();
  const { data, error, loading } = useFetch('/dashboard/summary');

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (user?.full_name || 'Sarah').trim().split(/\s+/)[0];
  const periodLabel = data?.period?.label || 'This quarter';

  const kpis = [
    {
      key: 'clients',
      label: 'Total Clients',
      icon: 'group',
      accent: 'bg-primary-fixed/30',
      iconCls: 'text-primary',
      value: String(data?.totalClients ?? (loading ? '—' : 0)),
      badge: {
        show: true,
        dir: (Number(data?.clientDelta) || 0) >= 0 ? 'up' : 'down',
        text: `${Math.abs(Number(data?.clientDelta ?? 0)).toLocaleString('en-IN')}%`,
      },
    },
    {
      key: 'revenue',
      label: 'Revenue MTD',
      icon: 'payments',
      accent: 'bg-tertiary-fixed/30',
      iconCls: 'text-tertiary',
      value: fmtCurrency(data?.revenueMtd),
      subtitle: data?.revenueClientCount
        ? `From ${data.revenueClientCount} client${data.revenueClientCount === 1 ? '' : 's'}`
        : 'No payments recorded this month',
    },
    {
      key: 'pending',
      label: 'Pending Invoices',
      icon: 'receipt_long',
      accent: 'bg-error-container/50',
      iconCls: 'text-error',
      value: fmtCurrency(data?.pendingTotal),
      split: [
        { label: '0-30 Days', value: fmtCompact(data?.pending30) },
        { label: '30+ Days', value: fmtCompact(data?.pending30Plus), danger: true },
      ],
    },
    {
      key: 'overdue',
      label: 'Overdue Invoices',
      icon: 'account_balance_wallet',
      accent: 'bg-error-container/50',
      iconCls: 'text-error',
      value: fmtCurrency(data?.overdueTotal),
      badge: {
        show: true,
        dir: (Number(data?.overdueCount) || 0) > 0 ? 'down' : 'flat',
        text: `${data?.overdueCount || 0} Invoice${Number(data?.overdueCount) === 1 ? '' : 's'}`,
      },
      subtitle: Number(data?.overdueCount) > 0
        ? `${data.overdueCount} Overdue Invoice${data.overdueCount === 1 ? '' : 's'}`
        : 'No overdue invoices 🎉',
    },
  ];

  const iconAccent = (kpi) => kpi.accent;

  return (
    <div
      className="bg-background font-body-md text-on-background flex h-screen overflow-hidden"
      onClick={handleNav}
    >
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
          <a className="text-secondary dark:text-secondary-fixed-dim font-bold bg-secondary-fixed dark:bg-secondary-container rounded-lg font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out" href="#">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
            Dashboard
          </a>
          <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
            <span className="material-symbols-outlined text-[20px]">group</span>
            Clients
          </a>
          <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            Billing
          </a>
          <div className="flex flex-col">
            <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
              <span className="material-symbols-outlined text-[20px]">settings</span>
              Settings
              <span className="material-symbols-outlined text-sm ml-auto">expand_more</span>
            </a>
            <ul className="ml-6 mt-1 space-y-1 mb-1 border-l border-outline-variant dark:border-outline pl-3">
              <li><a className="block px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container hover:text-on-surface transition-all font-label-md text-label-md" href="#">Company Information</a></li>
              <li><a className="block px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container hover:text-on-surface transition-all font-label-md text-label-md" href="#">Team Members</a></li>
              <li><a className="block px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-container hover:text-on-surface transition-all font-label-md text-label-md" href="#">Roles &amp; Permissions</a></li>
            </ul>
          </div>
        </nav>
        <ul className="flex flex-col gap-1 mt-auto pt-stack-md border-t border-outline-variant dark:border-outline">
          <li>
            <a className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg" href="#">
              <span className="material-symbols-outlined text-[20px]">contact_support</span>
              Support
            </a>
          </li>
          <li>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); handleLogout(); }}
              className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-3 px-3 py-2 hover:bg-surface-container-high dark:hover:bg-surface-container transition-all duration-200 ease-in-out rounded-lg"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Logout
            </a>
          </li>
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:ml-64 w-full relative h-screen overflow-hidden">
        {/* TopNavBar */}
        <header className="bg-surface-container-lowest dark:bg-inverse-surface border-b border-outline-variant dark:border-outline w-full h-16 sticky top-0 z-30 font-body-md text-body-md text-primary dark:text-primary-fixed flex items-center justify-between px-container-padding">
          <div className="hidden md:flex items-center bg-surface-container-low rounded-full px-4 py-2 w-96 border border-transparent focus-within:border-primary transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant mr-2 text-[20px]">search</span>
            <input className="bg-transparent border-none focus:ring-0 w-full text-body-md font-body-md text-on-surface placeholder-on-surface-variant p-0 m-0 outline-none" placeholder="Search clients, invoices..." type="text" />
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-surface-container-low rounded-lg border border-outline-variant px-3 py-2 cursor-pointer hover:bg-surface-container-high transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">calendar_today</span>
              <span className="font-body-md text-body-md text-on-surface">{periodLabel}</span>
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">expand_more</span>
            </div>
            <button type="button" className="relative p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full">
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              <span className="absolute top-1 right-1 bg-error text-on-error text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{data?.overdueCount || 0}</span>
            </button>
            <button type="button" className="p-2 text-on-surface-variant hover:bg-surface-container-low transition-colors rounded-full">
              <span className="material-symbols-outlined text-[24px]">help</span>
            </button>
            <div className="hidden md:block w-8 h-8 rounded-full bg-surface-variant border border-outline-variant overflow-hidden">
              <img alt="User profile avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD6JU0IdWSZ7-CjN638O-WcW2BmfgiG5tdXzTH__XGaKHzEXizpDaWTlYRWlw-vnPLhfyL1Nds2rOLQkuW-oKi5AsDSAjNw9A23JdslOl6ok5RVpBEJktRqYBkG-FuXSpUEK76KwXXg5_O8BGT9cVBvExeB8sRQIt-RGZhGmgcsTKlVpymeWgiLfkQv6lXQ0UDXvKrv0nL3C1AchdCMgzX6nUky5Y2y5FnjyOJ0nfstXBJag2MNwEs" />
            </div>
          </div>
        </header>

        {/* Scrollable Canvas */}
        <div className="flex-1 overflow-y-auto bg-background p-container-padding">
          <div className="max-w-[1440px] mx-auto space-y-stack-lg">
            {error && (
              <div className="bg-error-container border border-error/20 rounded-lg p-4 font-body-md text-body-md text-on-error-container">
                Could not load dashboard data: {error}
              </div>
            )}

            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-background">{greeting}, {firstName}.</h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  Here is the financial overview for {periodLabel}.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {can('clients.create') && (
                  <button type="button" onClick={() => navigate('/clients/new')} className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors">
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    Add Client
                  </button>
                )}
                {can('billing.create') && (
                  <button type="button" onClick={() => navigate('/invoices/new')} className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors">
                    <span className="material-symbols-outlined text-[18px]">post_add</span>
                    Create Invoice
                  </button>
                )}
              </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
              {kpis.map((kpi) => (
                <div key={kpi.key} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-label-md text-label-md text-on-surface-variant uppercase">{kpi.label}</span>
                    <div className={`w-10 h-10 rounded flex items-center justify-center ${iconAccent(kpi)}`}>
                      <span className={`material-symbols-outlined text-[20px] ${kpi.iconCls}`}>{kpi.icon}</span>
                    </div>
                  </div>

                  {kpi.split ? (
                    <div className="flex items-end gap-3">
                      <h3 className="font-headline-lg text-headline-lg text-on-background">{kpi.value}</h3>
                    </div>
                  ) : (
                    <div className="flex items-end gap-2">
                      <h3 className="font-headline-lg text-headline-lg text-on-background">{kpi.value}</h3>
                      {kpi.badge?.show && (
                        <div className={`flex items-center px-1.5 py-0.5 rounded font-label-md text-label-md mb-1 ${kpi.badge.dir === 'down' ? 'text-error bg-error-container/60' : 'text-tertiary-container bg-tertiary-fixed'}`}>
                          <span className="material-symbols-outlined text-[14px]">
                            {kpi.badge.dir === 'down' ? 'trending_down' : kpi.badge.dir === 'up' ? 'trending_up' : 'trending_flat'}
                          </span>
                          <span className="ml-1">{kpi.badge.text}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {kpi.split && (
                    <div className="flex gap-4 mt-3 font-label-md text-label-md">
                      {kpi.split.map((item) => (
                        <div key={item.label} className="flex flex-col">
                          <span className={item.danger ? 'text-error-container' : 'text-on-surface-variant'}>{item.label}</span>
                          <span className={`font-bold ${item.danger ? 'text-error' : 'text-on-background'}`}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {kpi.subtitle && (
                    <div className="mt-3">
                      <span className="font-label-md text-label-md text-on-surface-variant">{kpi.subtitle}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
