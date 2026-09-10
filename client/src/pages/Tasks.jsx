import { useCallback, useEffect, useRef, useState } from 'react';
import { useFetch } from '../hooks/useFetch.js';
import { usePerm } from '../hooks/usePerm.js';
import { useTeam } from '../hooks/useTeam.js';
import { useServices } from '../hooks/useServices.js';
import { authHeaders } from '../utils/authHeader.js';
import TaskCardModal from '../components/TaskCardModal.jsx';

function avatar(name) {
  return (name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function initialsColor(name) {
  const colors = ['#0b6bcb', '#7c3aed', '#16a34a', '#b45309', '#0d9488', '#ba1a1a', '#6b21a8'];
  let hash = 0;
  for (const c of (name || 'U')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function toDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt) ? null : dt;
}

function dateKey(d) {
  const dt = toDate(d);
  if (!dt) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function fmtDate(d) {
  const dt = toDate(d);
  if (!dt) return '—';
  const day = dt.getDate();
  const mon = dt.toLocaleString('en-IN', { month: 'short' });
  return `${day} ${mon}`;
}

function isOverdue(d) {
  if (!d) return false;
  const dt = toDate(d);
  if (!dt) return false;
  const endOfDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59);
  return endOfDay < new Date();
}

const STATUSES = [
  { key: 'todo', label: 'To Do', icon: 'check_box_outline_blank', border: 'border-outline-variant' },
  { key: 'in_progress', label: 'In Progress', icon: 'progress_activity', border: 'border-primary/40' },
  { key: 'done', label: 'Completed', icon: 'check_circle', border: 'border-green-600/40' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const YEARS = (() => {
  const y = new Date().getFullYear();
  const arr = [];
  for (let i = y - 2; i <= y + 1; i++) arr.push(i);
  return arr;
})();

const SERVICE_COLORS = {
  GST: 'bg-primary-fixed text-primary',
  TDS: 'bg-green-100 text-green-800',
  TCS: 'bg-green-100 text-green-800',
  ITR: 'bg-purple-100 text-purple-800',
  AUDIT: 'bg-teal-100 text-teal-800',
  ROC: 'bg-amber-100 text-amber-800',
};

function svcTag(serviceName) {
  if (!serviceName) return null;
  const upper = serviceName.toUpperCase();
  const cls = Object.entries(SERVICE_COLORS).find(([k]) => upper.includes(k))?.[1] || 'bg-surface-container-high text-on-surface-variant';
  const code = upper.replace(/FILING|RETURN|PROCESSING|COMPLIANCE|ANNUAL|MONTHLY|QUARTERLY|ONE-OFF|TAX|STATUTORY|SECRETARIAL|INCORPORATION|FINANCIAL|STATEMENT|BOOKKEEPING|PAYROLL|INCOME|ADVISORY|OPTED/g, '').trim().slice(0, 10) || serviceName.slice(0, 10);
  return <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{code}</span>;
}

export default function Tasks() {
  const can = usePerm();
  const [view, setView] = useState('board');
  const [serviceFilter, setServiceFilter] = useState(null);
  const [modalTaskId, setModalTaskId] = useState(null);
  const [createMode, setCreateMode] = useState(null);
  const [toast, setToast] = useState('');
  const toastRef = useRef(null);

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth()); // 0-11, -1 = all
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [moreOpen, setMoreOpen] = useState(false);

  const qs = serviceFilter ? `?service_id=${serviceFilter}` : '';
  const { data: allTasks, error, loading, reload } = useFetch(`/tasks${qs}`);

  const tasks = Array.isArray(allTasks) ? allTasks : [];
  const openTasksAll = tasks.filter((t) => !t.archived);

  // Filter by selected month/year (based on due date). Tasks with no due date
  // are unscheduled and always shown. filterMonth=-1 shows everything.
  const inPeriod = (t) => {
    if (filterMonth === -1 || !t.due_date) return true;
    const d = new Date(t.due_date);
    return d.getFullYear() === filterYear && d.getMonth() === filterMonth;
  };

  const openTasks = openTasksAll.filter(inPeriod);
  const boardTasks = openTasks.filter((t) => t.status !== 'done');
  const reviewTasks = openTasks.filter((t) => t.removed_at && t.status !== 'done');

  const todoTasks = boardTasks.filter((t) => t.status === 'todo');
  const inProgressTasks = boardTasks.filter((t) => t.status === 'in_progress');
  const doneTasks = openTasks.filter((t) => t.status === 'done' && !t.archived);

  // Statutory deadline strip — computed from live tasks
  const STAT_DEFS = [
    { key: 'gstr3b', label: 'GSTR-3B', icon: 'calendar_month', color: 'text-primary', match: (t) => /GSTR-3B/.test(t.title) },
    { key: 'tds', label: 'TDS Payment', icon: 'payments', color: 'text-green-700', match: (t) => /Deposit monthly TDS\/TCS|TDS return/.test(t.title) },
    { key: 'itr', label: 'ITR', icon: 'receipt_long', color: 'text-purple-700', match: (t) => /Income Tax Return|ITR/.test(t.title) },
    { key: 'roc', label: 'ROC', icon: 'account_balance', color: 'text-amber-700', match: (t) => /ROC compliance|AOC-4|MGT-7/.test(t.title) },
  ];
  const statOpen = tasks.filter((t) => t.status !== 'done' && !t.archived && !t.removed_at && t.due_date);
  const statCards = STAT_DEFS.map((def) => {
    const matches = statOpen.filter(def.match);
    const clients = new Set(matches.map((t) => t.client_id).filter(Boolean)).size;
    const dates = matches.map((t) => new Date(t.due_date)).filter((d) => !isNaN(d)).sort((a, b) => a - b);
    const earliest = dates[0];
    return {
      ...def,
      date: earliest ? fmtDate(earliest) : '—',
      month: earliest ? earliest.toLocaleString('en-IN', { month: 'short', year: 'numeric' }) : '—',
      body: clients === 0 ? 'No filings due' : `${clients} client${clients === 1 ? '' : 's'} filing due`,
    };
  });

  const teamData = useTeam();
  const memberList = Array.isArray(teamData?.members) ? teamData.members : [];

  const svcList = useServices();

  const { data: clients } = useFetch('/clients');
  const clientList = Array.isArray(clients) ? clients : [];
  const countBySvc = {};
  clientList.forEach((c) => (c.services || []).forEach((s) => {
    countBySvc[s.id] = (countBySvc[s.id] || 0) + 1;
  }));
  const sortedSvcs = [...svcList].sort(
    (a, b) => (countBySvc[b.id] || 0) - (countBySvc[a.id] || 0) || a.name.localeCompare(b.name)
  );

  function flash(msg) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(''), 2200);
  }

  async function moveTask(taskId, newStatus) {
    const res = await fetch(`/api/tasks/${taskId}/move`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      flash(json?.error || 'Failed to move task');
      return;
    }
    flash(`Moved to ${newStatus === 'todo' ? 'To Do' : newStatus === 'in_progress' ? 'In Progress' : 'Completed'}`);
    reload();
  }

  async function completeTask(taskId) {
    const res = await fetch(`/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      flash(json?.error || 'Failed to complete task');
      return;
    }
    flash('Task completed');
    reload();
  }

  async function archiveTask(taskId) {
    const res = await fetch(`/api/tasks/${taskId}/archive`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      flash(json?.error || 'Failed to archive task');
      return;
    }
    flash('Task archived');
    reload();
  }

  // --- Drag handlers ---
  const dragId = useRef(null);

  function handleDragStart(e, taskId) {
    dragId.current = taskId;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
  }

  function handleDragEnd(e) {
    e.currentTarget.style.opacity = '';
    dragId.current = null;
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('border-primary', 'bg-primary/5');
  }

  function handleDragLeave(e) {
    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
  }

  function handleDrop(e, targetStatus) {
    e.preventDefault();
    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
    const id = dragId.current;
    dragId.current = null;
    if (id) moveTask(id, targetStatus);
  }

  if (!(can('engagements.view') || can('clients.view'))) {
    return <div className="p-8 text-center text-on-surface-variant">You don't have permission to view tasks.</div>;
  }

  const cardCls = 'bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card';
  const labelCls = 'font-label-md text-label-md text-on-surface-variant block mb-unit';

  return (
    <div className="space-y-stack-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-background">Tasks &amp; Compliance</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Every filing, audit and follow-up — tied to the client, the service and the statutory deadline.</p>
        </div>
      </div>

      {/* Statutory deadline strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {statCards.map((s) => (
          <div key={s.key} className={`${cardCls} p-4 flex gap-3 items-start`}>
            <div className="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center text-sm font-bold shrink-0">
              <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold">{s.label} · {s.month}</div>
              <div className="text-headline-sm font-headline-sm font-bold mt-0.5">{s.date}</div>
              <div className="text-body-sm text-on-surface-variant">{s.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex bg-surface-container-high rounded-xl p-0.5 gap-0.5">
          {[{ key: 'board', label: 'Board', icon: 'view_kanban' }, { key: 'list', label: 'List', icon: 'view_list' }, { key: 'calendar', label: 'Calendar', icon: 'calendar_month' }].map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 rounded-lg font-label-md text-label-md inline-flex items-center gap-1.5 ${view === v.key ? 'bg-surface-container-lowest text-primary shadow-card' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[16px]">{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-3">
          {/* Add Task */}
          <button
            onClick={() => setCreateMode(true)}
            className="px-3.5 py-2 rounded-full bg-primary text-white font-label-md text-label-md inline-flex items-center gap-1.5 hover:bg-primary/90 shadow-card"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Task
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setServiceFilter(null)}
            className={`px-3 py-1.5 rounded-full font-label-md text-label-md border ${!serviceFilter ? 'bg-primary text-white border-primary' : 'border-outline-variant text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low'}`}
          >All</button>
          {sortedSvcs.slice(0, 6).map((s) => (
            <button
              key={s.id}
              onClick={() => setServiceFilter(s.id)}
              className={`px-3 py-1.5 rounded-full font-label-md text-label-md border ${serviceFilter === s.id ? 'bg-primary text-white border-primary' : 'border-outline-variant text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low'}`}
            >{s.name.length > 16 ? s.name.slice(0, 16) + '…' : s.name}</button>
          ))}
          {sortedSvcs.length > 6 && (() => {
            const hidden = sortedSvcs.slice(6);
            const activeInMore = serviceFilter && hidden.some((s) => s.id === serviceFilter);
            return (
              <div className="relative">
                {moreOpen && <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />}
                <button
                  onClick={() => setMoreOpen((o) => !o)}
                  className={`px-3 py-1.5 rounded-full font-label-md text-label-md border inline-flex items-center gap-1 ${activeInMore ? 'bg-primary text-white border-primary' : 'border-outline-variant text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low'}`}
                >
                  +{hidden.length} more
                  <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
                </button>
                {moreOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl bg-surface-container-lowest border border-outline-variant shadow-card p-2">
                    {hidden.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setServiceFilter(s.id); setMoreOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-label-md mb-0.5 last:mb-0 font-label-md ${serviceFilter === s.id ? 'bg-primary text-white' : 'text-on-surface hover:bg-surface-container-low'}`}
                      >{s.name}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Month / Year filter (matches app select pattern) — far right, same line as Add Task */}
        <div className="inline-flex items-center gap-2 ml-auto">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-1.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors cursor-pointer"
          >
            <option value={-1}>All months</option>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-1.5 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors cursor-pointer"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-body-md">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-on-surface-variant">Loading tasks…</div>
      ) : (
        <>
          {/* Review banner */}
          {reviewTasks.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span><b>{reviewTasks.length} task{reviewTasks.length === 1 ? '' : 's'}</b> waiting on a removed-service decision — stays in queue until completed or archived.</span>
            </div>
          )}

          {/* ============ BOARD VIEW ============ */}
          {view === 'board' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {STATUSES.map((col) => {
                const colTasks = col.key === 'todo' ? todoTasks : col.key === 'in_progress' ? inProgressTasks : doneTasks;
                return (
                  <div
                    key={col.key}
                    className={`${cardCls} p-3`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.key)}
                  >
                    <div className="flex items-center gap-2 px-2 pb-3">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{col.icon}</span>
                      <span className="font-headline-sm text-headline-sm">{col.label}</span>
                      <span className="ml-auto bg-surface-container-high text-on-surface-variant text-[11px] font-bold px-2 py-0.5 rounded-full">{colTasks.length}</span>
                    </div>
                    <div className="space-y-2 min-h-[100px]">
                      {colTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={() => setModalTaskId(task.id)}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onComplete={completeTask}
                        />
                      ))}
                      {colTasks.length === 0 && (
                        <div className="text-center py-8 text-on-surface-variant text-sm opacity-60">No tasks</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ============ LIST VIEW ============ */}
          {view === 'list' && (
            <div className={`${cardCls} overflow-hidden`}>
              {/* Review group */}
              {reviewTasks.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border-b border-outline-variant">
                    <span className="text-[13px] font-bold text-red-700">⚠</span>
                    <span className="font-headline-sm text-headline-sm">Needs review</span>
                    <span className="ml-auto text-sm text-on-surface-variant">{reviewTasks.length} task{reviewTasks.length === 1 ? '' : 's'} · service removed</span>
                  </div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-on-surface-variant bg-surface-container-low">
                        <th className="w-10 px-4 py-2"></th>
                        <th className="px-4 py-2">Task</th>
                        <th className="px-4 py-2">Client</th>
                        <th className="px-4 py-2">Due</th>
                        <th className="px-4 py-2">Assignee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewTasks.map((task) => (
                        <tr key={task.id} className="bg-red-50/50 hover:bg-red-50 cursor-pointer border-b border-outline-variant" onClick={() => setModalTaskId(task.id)}>
                          <td className="px-4 py-3"><span className={`w-4 h-4 rounded border-2 inline-block ${task.status === 'done' ? 'bg-green-600 border-green-600' : 'border-outline-variant'}`}></span></td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-sm">{task.title}</span>
                            <span className="ml-2 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">⚠ Removed</span>
                            {task.checklist_total > 0 && <span className="ml-2 text-xs text-on-surface-variant">☑ {task.checklist_done}/{task.checklist_total}</span>}
                          </td>
                          <td className="px-4 py-3 text-sm">{task.client_name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-red-600 font-semibold">{fmtDate(task.due_date)}</td>
                          <td className="px-4 py-3">{task.assigned_to_name ? <span className="inline-flex items-center gap-1.5 text-sm"><span className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ background: initialsColor(task.assigned_to_name) }}>{avatar(task.assigned_to_name)}</span>{task.assigned_to_name}</span> : <span className="text-on-surface-variant text-sm">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Normal grouped list */}
              {(() => {
                const groups = {};
                openTasks.forEach((t) => {
                  if (reviewTasks.includes(t) && t.status === 'todo') return;
                  const key = t.assigned_to || '_unassigned';
                  if (!groups[key]) groups[key] = { name: t.assigned_to_name || 'Unassigned', id: key, tasks: [] };
                  groups[key].tasks.push(t);
                });
                return Object.values(groups).map((g) => (
                  <div key={g.id}>
                    <div className="flex items-center gap-2 px-4 py-3 bg-surface-container-low border-b border-outline-variant">
                      <span className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: initialsColor(g.name) }}>{avatar(g.name)}</span>
                      <span className="font-headline-sm text-headline-sm">{g.name}</span>
                      <span className="ml-auto text-sm text-on-surface-variant">{g.tasks.length} task{g.tasks.length === 1 ? '' : 's'}</span>
                    </div>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-on-surface-variant bg-surface-container-low border-b border-outline-variant">
                          <th className="w-10 px-4 py-2"></th>
                          <th className="px-4 py-2">Task</th>
                          <th className="px-4 py-2">Client</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2">Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.tasks.map((task) => (
                          <tr key={task.id} className="hover:bg-surface-container-low cursor-pointer border-b border-outline-variant" onClick={() => setModalTaskId(task.id)}>
                            <td className="px-4 py-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); if (task.status !== 'done') completeTask(task.id); }}
                                className={`w-4 h-4 rounded border-2 inline-block hover:scale-110 transition-transform ${task.status === 'done' ? 'bg-green-600 border-green-600' : 'border-outline-variant hover:border-green-600'}`}
                              ></button>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-sm">{task.title}</span>
                              {task.service_name && <span className="ml-2">{svcTag(task.service_name)}</span>}
                              {task.checklist_total > 0 && <span className="ml-2 text-xs text-on-surface-variant">☑ {task.checklist_done}/{task.checklist_total}</span>}
                            </td>
                            <td className="px-4 py-3 text-sm">{task.client_name || '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${task.status === 'done' ? 'bg-green-100 text-green-800' : task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                                {task.status === 'todo' ? 'To Do' : task.status === 'in_progress' ? 'In Progress' : 'Done'}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-sm font-semibold ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-red-600' : 'text-on-surface-variant'}`}>{fmtDate(task.due_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* ============ CALENDAR VIEW ============ */}
          {view === 'calendar' && <CalendarView tasks={openTasks} baseMonth={filterMonth === -1 ? new Date().getMonth() : filterMonth} baseYear={filterYear} onClickTask={(id) => setModalTaskId(id)} />}

          {/* Empty state */}
          {!loading && openTasks.length === 0 && (
            <div className="py-16 text-center">
              <div className="material-symbols-outlined text-[48px] text-on-surface-variant opacity-40 mb-3">task_alt</div>
              <div className="font-headline-md text-headline-md text-on-surface-variant">No tasks yet</div>
              <div className="text-body-md text-on-surface-variant mt-1">Tasks are auto-generated when a client opts into a service.</div>
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-inverse-surface text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-card-lg z-50">{toast}</div>
      )}

      {/* Modal */}
      {(modalTaskId || createMode) && (
        <TaskCardModal
          taskId={createMode ? null : modalTaskId}
          onClose={() => { setModalTaskId(null); setCreateMode(null); reload(); }}
        />
      )}
    </div>
  );
}

/* ---------- TaskCard (board card) ---------- */
function TaskCard({ task, onClick, onDragStart, onDragEnd, onComplete }) {
  const removed = task.removed_at;
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`rounded-lg border p-3 cursor-pointer transition-all hover:shadow-card ${removed ? 'bg-red-50 border-red-200' : 'bg-surface-container-lowest border-outline-variant hover:border-primary'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-[13px] leading-tight line-clamp-2">{task.title}</span>
        <button
          onClick={(e) => { e.stopPropagation(); if (!removed && task.status !== 'done') onComplete(task.id); }}
          className={`w-4 h-4 rounded border-2 shrink-0 mt-0.5 ${task.status === 'done' ? 'bg-green-600 border-green-600' : 'border-outline-variant hover:border-green-600'}`}
          title="Mark done"
        ></button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {task.service_name && svcTag(task.service_name)}
        {task.client_name && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">{task.client_name.length > 16 ? task.client_name.slice(0, 16) + '…' : task.client_name}</span>}
        {removed && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">⚠ Removed</span>}
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[11px] text-on-surface-variant">{task.checklist_total > 0 ? `☑ ${task.checklist_done}/${task.checklist_total}` : ''}</span>
        <div className="flex items-center gap-2">
          {task.due_date && <span className={`text-[11px] font-semibold ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-red-600' : 'text-on-surface-variant'}`}>{fmtDate(task.due_date)}</span>}
          {task.assigned_to_name && <span className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ background: initialsColor(task.assigned_to_name) }}>{avatar(task.assigned_to_name)}</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------- CalendarView ---------- */
function CalendarView({ tasks, onClickTask, baseMonth, baseYear }) {
  const [offset, setOffset] = useState(0);
  const now = new Date();
  // When the toolbar month/year changes, reset navigation back to it.
  useEffect(() => { setOffset(0); }, [baseMonth, baseYear]);
  const base = new Date(baseYear ?? now.getFullYear(), baseMonth ?? now.getMonth(), 1);
  const target = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const calYear = target.getFullYear();
  const calMonth = target.getMonth();
  const firstDay = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const tasksByDate = {};
  tasks.forEach((t) => {
    const k = dateKey(t.due_date);
    if (!k) return;
    if (!tasksByDate[k]) tasksByDate[k] = [];
    tasksByDate[k].push(t);
  });

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const monthLabel = target.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-gutter">
      <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setOffset((o) => o - 1)} className="p-1.5 hover:bg-surface-container-low rounded-lg"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
          <span className="font-headline-sm text-headline-sm">{monthLabel}</span>
          <button onClick={() => setOffset((o) => o + 1)} className="p-1.5 hover:bg-surface-container-low rounded-lg"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
        </div>
        <div className="grid grid-cols-7 gap-px">
          {dayNames.map((d) => <div key={d} className="text-center text-[11px] uppercase tracking-wide text-on-surface-variant font-bold py-2">{d}</div>)}
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} className="min-h-[70px]"></div>;
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTasks = tasksByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            return (
              <div key={day} className={`min-h-[70px] border border-outline-variant rounded-lg p-1 text-right ${isToday ? 'bg-primary-fixed border-primary' : 'bg-surface-container-lowest'}`}>
                <span className={`text-[12px] font-semibold ${isToday ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>{day}</span>
                <div className="mt-0.5 space-y-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <div key={t.id} onClick={() => onClickTask(t.id)} className={`text-[9px] px-1 py-0.5 rounded cursor-pointer truncate ${t.removed_at ? 'bg-red-100 text-red-800' : t.status === 'done' ? 'bg-green-100 text-green-800' : 'bg-primary-fixed text-primary'}`}>
                      {t.title.slice(0, 20)}
                    </div>
                  ))}
                  {dayTasks.length > 3 && <div className="text-[9px] text-on-surface-variant">+{dayTasks.length - 3}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-card p-4">
        <h3 className="font-headline-sm text-headline-sm mb-3">Due this month</h3>
        <div className="space-y-2">
          {tasks.filter((t) => {
            if (!t.due_date) return false;
            const d = new Date(t.due_date);
            return d.getMonth() === calMonth && d.getFullYear() === calYear;
          }).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).slice(0, 10).map((t) => (
            <div key={t.id} onClick={() => onClickTask(t.id)} className="flex items-start gap-2 p-2 rounded-lg hover:bg-surface-container-low cursor-pointer border-b border-outline-variant last:border-0">
              <div className={`text-center shrink-0 w-10 rounded-lg py-1 ${isOverdue(t.due_date) && t.status !== 'done' ? 'bg-red-100' : 'bg-surface-container-low'}`}>
                <div className={`text-[10px] uppercase font-bold ${isOverdue(t.due_date) && t.status !== 'done' ? 'text-red-600' : 'text-on-surface-variant'}`}>{new Date(t.due_date).toLocaleString('en-IN', { month: 'short' })}</div>
                <div className={`text-[16px] font-bold ${isOverdue(t.due_date) && t.status !== 'done' ? 'text-red-700' : 'text-primary'}`}>{new Date(t.due_date).getDate()}</div>
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[12px] truncate">{t.title}</div>
                <div className="text-[11px] text-on-surface-variant truncate">{t.client_name || '—'} · {t.assigned_to_name || 'Unassigned'}</div>
              </div>
            </div>
          ))}
          {tasks.filter((t) => {
            if (!t.due_date) return false;
            const d = new Date(t.due_date);
            return d.getMonth() === calMonth && d.getFullYear() === calYear;
          }).length === 0 && (
            <div className="text-center py-6 text-on-surface-variant text-sm">No due dates this month</div>
          )}
        </div>
      </div>
    </div>
  );
}
