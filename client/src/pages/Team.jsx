import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { authHeaders } from '../utils/authHeader.js';

const ROLE_LABELS = { admin: 'Admin', accountant: 'Accountant', consultant: 'Consultant' };
const ROLE_OPTIONS = ['admin', 'accountant', 'consultant'];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Team() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data, loading, reload } = useFetch('/team');

  const members = data?.members || [];
  const invites = data?.invites || [];

  const [inviteForm, setInviteForm] = useState({ email: '', role: 'consultant' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function mutate(path, options = {}) {
    const res = await fetch(path, {
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      ...options,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
    return json;
  }

  async function handleInvite(e) {
    e.preventDefault();
    setNotice('');
    if (!inviteForm.email.trim()) {
      setNotice('Please enter a team member email.');
      return;
    }
    setBusy(true);
    try {
      const data = await mutate('/api/team/invites', {
        method: 'POST',
        body: JSON.stringify({ email: inviteForm.email, role: inviteForm.role }),
      });
      setNotice(
        `Invite sent to ${inviteForm.email.trim()}. ${data.devInviteUrl ? `Invite link (dev only): ${data.devInviteUrl}` : ''}`,
      );
      setInviteForm({ email: '', role: 'consultant' });
      reload();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(invite) {
    if (!window.confirm(`Revoke the invite for ${invite.email}?`)) return;
    setNotice('');
    try {
      await mutate(`/api/team/invites/${invite.id}`, { method: 'DELETE', headers: authHeaders() });
      reload();
      setNotice('Invite revoked.');
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function handleRoleChange(member, role) {
    setNotice('');
    try {
      await mutate(`/api/team/members/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      reload();
      setNotice(`${member.full_name} is now ${ROLE_LABELS[role]}.`);
    } catch (err) {
      setNotice(err.message);
    }
  }

  async function handleToggleActive(member) {
    if (!window.confirm(`${member.is_active ? 'Deactivate' : 'Activate'} ${member.full_name}?`)) return;
    setNotice('');
    try {
      await mutate(`/api/team/members/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !member.is_active }),
      });
      reload();
      setNotice(`${member.full_name} ${member.is_active ? 'deactivated' : 'activated'}.`);
    } catch (err) {
      setNotice(err.message);
    }
  }

  return (
    <div>
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-container-padding bg-background">
          <div className="max-w-[1440px] mx-auto">
            {notice && (
              <div className="mb-stack-md px-4 py-3 rounded-lg bg-primary-fixed/40 border border-outline-variant font-body-md text-body-md text-on-surface flex items-center justify-between gap-3">
                <span className="break-all">{notice}</span>
                <button type="button" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface shrink-0" onClick={() => setNotice('')}>Dismiss</button>
              </div>
            )}

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-stack-lg gap-4">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Team Members</h2>
                <p className="font-body-lg text-body-lg text-on-surface-variant">Invite colleagues to your workspace and manage who can access it.</p>
              </div>
            </div>

            {!isAdmin && (
              <div className="mb-stack-md px-4 py-3 rounded-lg bg-surface-container-low border border-outline-variant font-body-md text-body-md text-on-surface-variant">
                Only administrators can invite or manage team members.
              </div>
            )}

            {/* Invite Form */}
            {isAdmin && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 mb-gutter flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1.5" htmlFor="invite_email">Email address</label>
                  <input
                    id="invite_email"
                    type="email"
                    className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder-on-surface-variant focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                    placeholder="teammate@company.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="w-full sm:w-48">
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1.5" htmlFor="invite_role">Role</label>
                  <select
                    id="invite_role"
                    className="w-full px-3.5 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors"
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={busy}
                  className="flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md px-5 py-2.5 rounded-lg hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm border border-transparent whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
                  {busy ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
              {/* Members */}
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Members</h3>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{members.length} total</span>
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  {loading && !members.length && (
                    <div className="px-5 py-10 text-center font-body-md text-body-md text-on-surface-variant">Loading…</div>
                  )}
                  {!loading && !members.length && (
                    <div className="px-5 py-10 text-center font-body-md text-body-md text-on-surface-variant">No members yet.</div>
                  )}
                  {members.map((member) => (
                    <div key={member.id} className="px-5 py-3.5 border-b border-outline-variant/60 last:border-b-0 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 font-label-md text-label-md">
                        {initials(member.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body-md text-body-md text-on-surface font-semibold truncate">{member.full_name}</p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-label-sm text-label-sm px-2 py-0.5 rounded-full ${member.is_active ? 'bg-tertiary-fixed/30 text-on-surface' : 'bg-surface-container-high text-on-surface-variant'}`}
                        >
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {isAdmin && member.id !== user?.id ? (
                          <>
                            <select
                              aria-label="Member role"
                              title="Change role"
                              value={member.role}
                              onChange={(e) => handleRoleChange(member, e.target.value)}
                              className="px-2 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              title={member.is_active ? 'Deactivate member' : 'Activate member'}
                              onClick={() => handleToggleActive(member)}
                              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">{member.is_active ? 'block' : 'play_circle'}</span>
                            </button>
                          </>
                        ) : (
                          <span className="font-label-md text-label-md text-on-surface-variant">{ROLE_LABELS[member.role]}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending Invites */}
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Pending Invites</h3>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{invites.length} pending</span>
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  {!invites.length && (
                    <div className="px-5 py-10 text-center font-body-md text-body-md text-on-surface-variant">
                      {isAdmin ? 'Invite a teammate to get started.' : 'No pending invites.'}
                    </div>
                  )}
                  {invites.map((invite) => (
                    <div key={invite.id} className="px-5 py-3.5 border-b border-outline-variant/60 last:border-b-0 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0 font-label-md text-label-md">
                        <span className="material-symbols-outlined text-[18px]">mail</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body-md text-body-md text-on-surface font-semibold truncate">{invite.email}</p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          {ROLE_LABELS[invite.role]} · Expires {formatDate(invite.expires_at)}
                        </p>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          title="Revoke invite"
                          onClick={() => handleRevoke(invite)}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">link_off</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}