import { useState } from 'react';

export function servicePlan(s) {
  const name = s.name.toLowerCase();
  if (name.includes('gst') && name.includes('filing')) return { label: 'GSTR-1 · GSTR-3B', rule: 'Monthly · 11th & 20th', color: '#0b6bcb' };
  if (name.includes('tds') || name.includes('tcs')) return { label: 'TDS / TCS Compliance', rule: 'Quarterly 24Q · 31st', color: '#16a34a' };
  if (name.includes('itr') || name.includes('income tax') || name.includes('tax return')) return { label: 'Income Tax Return', rule: 'Annual · due 31 Jul', color: '#7c3aed' };
  if (name.includes('statutory audit')) return { label: 'Statutory Audit', rule: 'One-off · per FY', color: '#0d9488' };
  if (name.includes('tax audit')) return { label: 'Tax Audit', rule: 'One-off · per FY', color: '#0d9488' };
  if (name.includes('roc') || name.includes('secretarial') || name.includes('incorporation')) return { label: 'ROC Compliance', rule: 'Annual · AOC-4/MGT-7 · 31 Oct', color: '#b45309' };
  if (name.includes('bookkeeping')) return { label: 'Bookkeeping', rule: 'Monthly · books close 5th', color: '#16a34a' };
  if (name.includes('payroll')) return { label: 'Payroll Processing', rule: 'Monthly · run by 28th', color: '#16a34a' };
  if (name.includes('financial statement')) return { label: 'Financial Statements', rule: 'Annual · per FY', color: '#7c3aed' };
  return { label: s.name, rule: s.is_recurring ? 'Recurring · per period' : 'On request', color: '#0b6bcb' };
}

export default function ServicesOpted({ services, selectedIds, onChange }) {
  const [q, setQ] = useState('');
  const filtered = services.filter((s) => !q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase()));
  const selected = services.filter((s) => selectedIds.includes(s.id));

  return (
    <div className="space-y-3">
      <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-outline-variant bg-surface-container-low">
          <span className="font-body-sm text-body-sm font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
            Selected services
          </span>
          <span className="bg-primary text-white rounded-full px-2 py-0.5 text-[11px] font-bold">{selectedIds.length}</span>
        </div>

        <div className="flex flex-wrap gap-2 px-4 py-3 min-h-[54px] items-center">
          {selected.length === 0 ? (
            <span className="font-body-sm text-body-sm text-on-surface-variant">None selected — pick from the list below</span>
          ) : (
            selected.map((s) => {
              const plan = servicePlan(s);
              return (
                <span key={s.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary text-white font-body-sm text-body-sm font-medium shadow-sm">
                  <span className="w-2 h-2 rounded-full ring-1 ring-white/50" style={{ background: plan.color }} />
                  {s.name}
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => onChange(s.id)}
                    className="w-4 h-4 rounded-full bg-white/20 hover:bg-white hover:text-primary grid place-items-center transition-colors"
                  >
                    <span className="material-symbols-outlined text-[13px]">close</span>
                  </button>
                </span>
              );
            })
          )}
        </div>

        <div className="px-4 py-2.5 border-y border-outline-variant">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search services (e.g. GST, TDS, ITR...)"
            className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>

        <div className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-center font-body-sm text-body-sm text-on-surface-variant">
              {services.length === 0 ? 'No services found. Add them in Settings → Services.' : 'No services match your search.'}
            </div>
          ) : (
            filtered.map((s) => {
              const plan = servicePlan(s);
              const on = selectedIds.includes(s.id);
              return (
                <div
                  key={s.id}
                  role="checkbox"
                  aria-checked={on}
                  tabIndex={0}
                  onClick={() => onChange(s.id)}
                  onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(s.id); } }}
                  className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors select-none ${on ? 'bg-primary-container/40' : 'hover:bg-surface-container-low'}`}
                >
                  <span
                    className={`w-[18px] h-[18px] border-2 rounded-[5px] grid place-items-center shrink-0 transition-colors ${on ? 'bg-primary border-primary text-white' : 'border-outline bg-surface-container-lowest'}`}
                  >
                    {on && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: plan.color }} />
                  <span className="flex-1 min-w-0 font-body-sm text-body-sm font-medium text-on-surface truncate">{s.name}</span>
                  <span className="shrink-0 font-body-sm text-body-sm text-on-surface-variant font-medium whitespace-nowrap">{plan.rule}</span>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-outline-variant bg-surface-container-low font-body-sm text-body-sm text-on-surface-variant">
          Toggling a service adds its filing tasks to <b className="text-on-surface">Tasks &amp; Compliance</b> automatically.
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-primary-fixed border border-primary/20 font-body-sm text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px] text-green-700 mt-[1px]">task_alt</span>
          <span>
            <b className="text-on-surface">{selectedIds.length} {selectedIds.length === 1 ? 'service' : 'services'}</b> selected — their filing tasks appear automatically under Tasks &amp; Compliance and stay in sync if you edit them later.
          </span>
        </div>
      )}
    </div>
  );
}