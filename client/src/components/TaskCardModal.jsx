import { useEffect, useRef, useState } from 'react';
import { useFetch } from '../hooks/useFetch.js';
import { authHeaders } from '../utils/authHeader.js';

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return `${dt.getDate()} ${dt.toLocaleString('en-IN', { month: 'short' })}`;
}

function isOverdue(d) {
  if (!d) return false;
  return new Date(d + 'T23:59:59') < new Date();
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function initialsColor(name) {
  const colors = ['#0b6bcb', '#7c3aed', '#16a34a', '#b45309', '#0d9488', '#ba1a1a'];
  let hash = 0;
  for (const c of (name || 'U')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function avatar(name) {
  return (name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

const STATUS_MAP = {
  todo: { label: 'To Do', cls: 'bg-surface-container-high text-on-surface-variant' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-800' },
  done: { label: 'Done', cls: 'bg-green-100 text-green-800' },
};

export default function TaskCardModal({ taskId, onClose }) {
  const isCreate = taskId == null;
  const { data: task, error, loading, reload } = useFetch(isCreate ? '/tasks?none=1' : `/tasks/${taskId}`, { enabled: !isCreate });
  const [desc, setDesc] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState('');
  const toastRef = useRef(null);
  const descTimer = useRef(null);

  // --- create-mode form state ---
  const [cTitle, setCTitle] = useState('');
  const [cClientId, setCClientId] = useState('');
  const [cAssigneeId, setCAssigneeId] = useState('');
  const [cDueDate, setCDueDate] = useState('');
  const [cChecklist, setCChecklist] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: clientsData } = useFetch(isCreate ? '/clients' : '/tasks?none=1', { enabled: isCreate });
  const { data: membersData } = useFetch(isCreate ? '/team' : '/tasks?none=1', { enabled: isCreate });
  const clientList = Array.isArray(clientsData) ? clientsData : (clientsData?.clients || []);
  const memberList = Array.isArray(membersData) ? membersData : (membersData?.members || []);

  function addChecklistDraft() {
    const v = newItem.trim();
    if (!v) return;
    setCChecklist((prev) => [...prev, v]);
    setNewItem('');
  }

  async function createTask() {
    const title = cTitle.trim();
    if (!title) {
      setCreateError('Title is required');
      return;
    }
    setCreating(true);
    setCreateError('');
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        title,
        description: desc.trim() || null,
        client_id: cClientId || null,
        assigned_to: cAssigneeId || null,
        due_date: cDueDate || null,
        checklist: cChecklist,
      }),
    });
    const json = await res.json().catch(() => null);
    setCreating(false);
    if (!res.ok) {
      setCreateError(json?.error || 'Failed to create task');
      return;
    }
    setSaved(true);
    flash('Task created');
    setTimeout(onClose, 500);
  }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function flash(msg) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(''), 2000);
  }

  async function saveDesc() {
    setSavingDesc(true);
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ description: desc }),
    });
    setSavingDesc(false);
  }

  function onDescChange(val) {
    setDesc(val);
    if (descTimer.current) clearTimeout(descTimer.current);
    descTimer.current = setTimeout(saveDesc, 600);
  }

  async function moveStatus(status) {
    await fetch(`/api/tasks/${taskId}/move`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status }),
    });
    flash(`Moved to ${status === 'todo' ? 'To Do' : status === 'in_progress' ? 'In Progress' : 'Completed'}`);
    reload();
  }

  async function completeTask() {
    await fetch(`/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    flash('Task completed');
    reload();
  }

  async function archiveTask() {
    await fetch(`/api/tasks/${taskId}/archive`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    flash('Task archived');
    reload();
  }

  async function revertService() {
    await fetch(`/api/tasks/${taskId}/revert-service`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
    });
    flash('Service flag removed');
    reload();
  }

  async function addChecklistItem() {
    const title = newItem.trim();
    if (!title) return;
    await fetch(`/api/tasks/${taskId}/checklist`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ title }),
    });
    setNewItem('');
    reload();
  }

  async function toggleChecklistItem(itemId, currentDone) {
    await fetch(`/api/tasks/checklist/${itemId}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ is_done: !currentDone }),
    });
    reload();
  }

  async function deleteChecklistItem(itemId) {
    await fetch(`/api/tasks/checklist/${itemId}`, { method: 'DELETE', headers: authHeaders() });
    reload();
  }

  async function postComment() {
    const body = commentText.trim();
    if (!body) return;
    setPosting(true);
    await fetch(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ body }),
    });
    setCommentText('');
    setPosting(false);
    reload();
  }

  // ---------- CREATE MODE ----------
  if (isCreate) {
    const inputCls = 'w-full border border-outline-variant rounded-lg px-3 py-2 text-[13px] bg-surface-container-lowest focus:border-primary focus:outline-none';
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-6 pb-6 overflow-y-auto" onClick={onClose}>
        <div
          className="bg-surface rounded-xl shadow-card-lg w-full max-w-[720px] max-h-full overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-outline-variant sticky top-0 bg-surface z-10 rounded-t-xl">
            <div className="min-w-0">
              <h2 className="font-headline-md text-headline-md leading-tight">Add Task</h2>
              <div className="text-[12px] text-on-surface-variant mt-1">New task starts in To Do.</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high shrink-0">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-0">
            {/* Main column */}
            <div className="flex-1 min-w-0 px-6 py-5 space-y-5">
              {/* Title */}
              <div>
                <label className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold mb-2 block">Title <span className="text-error">*</span></label>
                <input
                  className={inputCls}
                  placeholder="e.g. File monthly GSTR-1"
                  value={cTitle}
                  onChange={(e) => setCTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createTask(); } }}
                  autoFocus
                />
              </div>

              {/* Client (optional) */}
              <div>
                <label className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold mb-2 block">Client</label>
                <select className={inputCls} value={cClientId} onChange={(e) => setCClientId(e.target.value)}>
                  <option value="">— No client (standalone task) —</option>
                  {clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Assignee (optional) */}
              <div>
                <label className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold mb-2 block">Assignee</label>
                <select className={inputCls} value={cAssigneeId} onChange={(e) => setCAssigneeId(e.target.value)}>
                  <option value="">— Unassigned —</option>
                  {memberList.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.name}</option>)}
                </select>
              </div>

              {/* Due date (optional) */}
              <div>
                <label className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold mb-2 block">Due date</label>
                <input type="date" className={inputCls} value={cDueDate} onChange={(e) => setCDueDate(e.target.value)} />
              </div>

              {/* Description (optional) */}
              <div>
                <h3 className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold mb-2">Description</h3>
                <textarea
                  className="w-full border border-outline-variant rounded-lg px-3 py-2 text-[13px] bg-surface-container-lowest resize-y min-h-[52px] max-h-[120px] focus:border-primary focus:outline-none"
                  placeholder="Add an optional description…"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>

              {/* Checklist (optional, pre-seed) */}
              <div>
                <h3 className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold mb-2">☑ Checklist</h3>
                <div className="space-y-1.5">
                  {cChecklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] bg-surface-container-low">
                      <span className="material-symbols-outlined text-[14px] text-on-surface-variant">drag_indicator</span>
                      <span className="flex-1">{item}</span>
                      <button onClick={() => setCChecklist((prev) => prev.filter((_, i) => i !== idx))} className="text-on-surface-variant hover:text-error">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ))}
                  {cChecklist.length === 0 && (
                    <div className="text-[12px] text-on-surface-variant px-1">No checklist items yet — optionally add some.</div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span
                      className="text-primary text-[13px] font-semibold cursor-pointer"
                      onClick={() => { if (newItem.trim()) addChecklistDraft(); }}
                    >＋</span>
                    <input
                      className="flex-1 border border-outline-variant rounded-md px-2 py-1 text-[13px] bg-surface-container-lowest focus:border-primary focus:outline-none"
                      placeholder="Add item…"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistDraft(); } }}
                    />
                  </div>
                </div>
              </div>

              {createError && <div className="px-3 py-2 rounded-lg bg-error-container text-on-error-container text-[13px]">{createError}</div>}
            </div>

            {/* Sidebar (create summary + submit) */}
            <div className="w-full lg:w-[220px] px-6 py-5 border-t lg:border-t-0 lg:border-l border-outline-variant bg-surface-container-lowest rounded-b-xl lg:rounded-r-xl lg:rounded-bl-none">
              <div className="space-y-2 text-[12px] mb-4">
                <div className="flex justify-between"><span className="text-on-surface-variant">Status</span><span className="font-semibold">To Do</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Client</span><span className="font-semibold truncate ml-2">{clientList.find((c) => c.id === cClientId)?.name || 'None'}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Assignee</span><span className="font-semibold truncate ml-2">{memberList.find((m) => m.id === cAssigneeId)?.full_name || memberList.find((m) => m.id === cAssigneeId)?.name || 'Unassigned'}</span></div>
              </div>
              <button
                onClick={createTask}
                disabled={creating || saved}
                className="w-full px-3 py-2.5 rounded-lg bg-primary text-white text-[13px] font-semibold hover:bg-primary/90 disabled:opacity-60"
              >
                {saved ? 'Created ✓' : creating ? 'Creating…' : 'Create Task'}
              </button>
              <div className="text-[11px] text-on-surface-variant mt-2 text-center">Client is optional — this can be a standalone task.</div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-[11px] text-on-surface-variant py-2 border-t border-outline-variant">The task will appear in the To Do column.</div>
        </div>

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-inverse-surface text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-card-lg z-50">{toast}</div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10" onClick={onClose}>
        <div className="bg-surface rounded-xl shadow-card-lg p-8 text-on-surface-variant">Loading…</div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10" onClick={onClose}>
        <div className="bg-surface rounded-xl shadow-card-lg p-8 text-error">{error || 'Task not found'}</div>
      </div>
    );
  }

  const removed = task.removed_at;
  const statusInfo = STATUS_MAP[task.status] || STATUS_MAP.todo;
  const checklistTotal = (task.checklist || []).length;
  const checklistDone = (task.checklist || []).filter((c) => c.is_done).length;
  const pct = checklistTotal ? Math.round(checklistDone / checklistTotal * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-6 pb-6 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-surface rounded-xl shadow-card-lg w-full max-w-[720px] max-h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-outline-variant sticky top-0 bg-surface z-10 rounded-t-xl">
          <div className="min-w-0">
            <h2 className="font-headline-md text-headline-md leading-tight">{task.title}</h2>
            <div className="flex items-center gap-2 mt-1.5 text-[12px] text-on-surface-variant">
              <span className={`inline-block px-2 py-0.5 rounded font-bold ${statusInfo.cls}`}>{statusInfo.label}</span>
              {task.service_name && <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-semibold">{task.service_name}</span>}
              {task.client_name && <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">{task.client_name}</span>}
              {task.period && <span className="text-on-surface-variant">· {task.period}</span>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high shrink-0">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Removed-service banner */}
        {removed && (
          <div className="mx-6 mt-4 flex gap-2.5 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-900">
            <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
            <div>
              <b>This service was removed from the client.</b>{' '}
              This task is paused and stays in queue until you complete or archive it.
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-0">
          {/* Main column */}
          <div className="flex-1 min-w-0 px-6 py-5 space-y-5">
            {/* Description */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold mb-2">Description</h3>
              <textarea
                className="w-full border border-outline-variant rounded-lg px-3 py-2 text-[13px] font-body-md text-on-surface resize-y min-h-[52px] max-h-[120px] focus:border-primary focus:outline-none"
                placeholder="Add an optional description…"
                value={desc}
                onChange={(e) => onDescChange(e.target.value)}
                onBlur={saveDesc}
              />
              {savingDesc && <span className="text-[11px] text-on-surface-variant">Saving…</span>}
            </div>

            {/* Checklist */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold mb-2">☑ Checklist</h3>
              {checklistTotal > 0 && (
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                  </div>
                  <span className="text-[11px] text-on-surface-variant font-semibold shrink-0">{checklistDone} of {checklistTotal}</span>
                </div>
              )}
              <div className="space-y-1.5">
                {(task.checklist || []).map((item) => (
                  <div key={item.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] group ${item.is_done ? 'bg-green-50 text-on-surface-variant line-through opacity-70' : 'bg-surface-container-low'}`}>
                    <button
                      onClick={() => toggleChecklistItem(item.id, item.is_done)}
                      className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center text-[9px] font-bold text-white transition-colors ${item.is_done ? 'bg-green-600 border-green-600' : 'border-outline hover:border-green-600'}`}
                    >{item.is_done ? '✓' : ''}</button>
                    <span className="flex-1">{item.title}</span>
                    <button onClick={() => deleteChecklistItem(item.id)} className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-opacity">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-primary text-[13px] font-semibold cursor-pointer" onClick={() => { if (newItem.trim()) addChecklistItem(); }}>＋</span>
                  <input
                    className="flex-1 border border-outline-variant rounded-md px-2 py-1 text-[13px] focus:border-primary focus:outline-none"
                    placeholder="Add item…"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
                  />
                </div>
              </div>
            </div>

            {/* Comments */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold mb-2">💬 Comments</h3>
              <div className="flex gap-2.5 items-start mb-3">
                <div className="w-7 h-7 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0">You</div>
                <div className="flex-1">
                  <textarea
                    className="w-full border border-outline-variant rounded-lg px-3 py-2 text-[13px] resize-y min-h-[38px] focus:border-primary focus:outline-none"
                    placeholder="Write a comment…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                  />
                  {commentText.trim() && (
                    <button onClick={postComment} disabled={posting} className="mt-1.5 px-3 py-1 bg-primary text-white rounded-md text-[12px] font-semibold disabled:opacity-50">Post</button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {(task.comments || []).map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0" style={{ background: initialsColor(c.user_name) }}>{avatar(c.user_name)}</div>
                    <div>
                      <div className="text-[12px]"><span className="font-bold">{c.user_name}</span> <span className="text-on-surface-variant ml-1.5">{timeAgo(c.created_at)}</span></div>
                      <div className="text-[13px] bg-surface-container-low rounded-lg rounded-tl-none px-3 py-2 mt-1">{c.body}</div>
                    </div>
                  </div>
                ))}
                {(task.comments || []).length === 0 && <div className="text-on-surface-variant text-sm text-center py-2">No comments yet</div>}
              </div>
            </div>

            {/* Service removal log */}
            {removed && (
              <div>
                <h3 className="text-[11px] uppercase tracking-wide text-red-600 font-bold mb-2">⚠ Service removal log</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="material-symbols-outlined text-[14px] text-red-600">warning</span>
                    <span className="font-bold text-red-800">Service removed</span>
                    <span className="text-red-700">by {task.removed_by_name || 'System'}</span>
                    <span className="text-red-500 ml-auto">{timeAgo(task.removed_at)}</span>
                  </div>
                  {task.removed_reason && <div className="text-[12px] text-red-700 italic">{task.removed_reason}</div>}
                </div>
              </div>
            )}

            {/* Activity */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold mb-2">🕒 Activity</h3>
              <div className="space-y-2">
                {(task.activity || []).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 text-[12px]">
                    <div className="w-5 h-5 rounded-full bg-surface-container-high text-on-surface-variant text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {a.action === 'completed' ? '✓' : a.action === 'created' ? '＋' : a.action === 'archived' ? '🗄' : a.action === 'service_removed' ? '⚠' : a.action === 'comment_added' ? '💬' : '→'}
                    </div>
                    <div>
                      <span className="font-semibold">{a.user_name || 'System'}</span>{' '}
                      <span className="text-on-surface-variant">
                        {a.action === 'completed' && 'marked task done'}
                        {a.action === 'created' && `created task${a.details?.source === 'service' ? ` from ${a.details.service}` : ''}`}
                        {a.action === 'archived' && 'archived task'}
                        {a.action === 'service_removed' && `flagged task — service "${a.details?.service}" removed`}
                        {a.action === 'service_reverted' && 'cleared service-removal flag'}
                        {a.action === 'comment_added' && 'added a comment'}
                        {a.action === 'status' && `moved to ${a.details?.to || '—'}`}
                        {a.action === 'checklist_added' && `added checklist item "${a.details?.title || ''}"`}
                        {a.action === 'checklist_toggle' && (a.details?.done ? 'checked item' : 'unchecked item')}
                        {a.action === 'checklist_removed' && 'removed checklist item'}
                        {a.action === 'updated_title' && 'updated title'}
                      </span>
                      <span className="text-on-surface-variant ml-1.5 text-[11px]">{timeAgo(a.created_at)}</span>
                    </div>
                  </div>
                ))}
                {(task.activity || []).length === 0 && <div className="text-on-surface-variant text-[12px]">No activity</div>}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-[220px] px-6 py-5 border-t lg:border-t-0 lg:border-l border-outline-variant bg-surface-container-lowest rounded-b-xl lg:rounded-r-xl lg:rounded-bl-none space-y-4">
            <div>
              <h3 className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold mb-2">Details</h3>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between"><span className="text-on-surface-variant">Status</span><span className="font-semibold">{statusInfo.label}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Due</span><span className={`font-semibold ${isOverdue(task.due_date) && task.status !== 'done' ? 'text-red-600' : ''}`}>{fmtDate(task.due_date)}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Assignee</span><span className="font-semibold">{task.assigned_to_name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Client</span><span className="font-semibold truncate ml-2">{task.client_name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Service</span><span className="font-semibold">{task.service_name || '—'}</span></div>
              </div>
            </div>

            <div className="border-t border-outline-variant pt-3 space-y-2">
              <h3 className="text-[11px] uppercase tracking-wide text-on-surface-variant font-bold mb-2">Actions</h3>
              {task.status === 'todo' && !removed && <button onClick={() => moveStatus('in_progress')} className="w-full text-left px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-[12px] font-semibold text-on-surface">▶ Start (In Progress)</button>}
              {task.status === 'in_progress' && !removed && <button onClick={() => moveStatus('todo')} className="w-full text-left px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-[12px] font-semibold text-on-surface">⏸ Move back to To Do</button>}
              {task.status !== 'done' && !removed && <button onClick={completeTask} className="w-full text-left px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[12px] font-semibold">✓ Mark Completed</button>}
              {removed && (
                <>
                  <button onClick={completeTask} className="w-full text-left px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[12px] font-semibold">✓ Mark Completed</button>
                  <button onClick={archiveTask} className="w-full text-left px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-[12px] font-semibold">🗄 Archive</button>
                  <button onClick={revertService} className="w-full text-left px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-[12px] font-semibold text-on-surface">↻ Revert service flag</button>
                </>
              )}
              {!removed && task.status !== 'done' && <button onClick={archiveTask} className="w-full text-left px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-[12px] font-semibold text-on-surface">🗄 Archive</button>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-on-surface-variant py-2 border-t border-outline-variant">Drag on the board or use these actions to manage status.</div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-inverse-surface text-white px-4 py-2.5 rounded-lg text-sm font-medium shadow-card-lg z-50">{toast}</div>
      )}
    </div>
  );
}
