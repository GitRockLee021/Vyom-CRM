import { useNavigate } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { usePerm } from '../hooks/usePerm.js';
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
  const can = usePerm();
  const { user } = useAuth();
  const { data, error, loading } = useFetch('/dashboard/summary');

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
            <h2 className="font-headline-lg text-headline-lg text-on-background">{greeting}, {firstName}.</h2>
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
            <div key={kpi.key} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-md shadow-card relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <span className="font-label-md text-label-md text-on-surface-variant uppercase">{kpi.label}</span>
                <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center ${iconAccent(kpi)}`}>
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
  );
}
