import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder-on-surface-variant focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors';
const labelCls = 'block font-label-md text-label-md text-on-surface-variant mb-1.5';

const ROLE_LABELS = {
  admin: 'Administrator',
  accountant: 'Accountant',
  consultant: 'Consultant',
};

export default function AcceptInvite() {
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [invite, setInvite] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data) {
          setValid(true);
          setInvite(data);
          setForm((f) => ({ ...f, email: data.email || '' }));
        } else {
          setValid(false);
          setError(data?.error || 'This invite link is invalid or has expired.');
        }
      } catch {
        if (!cancelled) {
          setValid(false);
          setError('Unable to validate this invite. Please try again.');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.full_name.trim() || !form.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await acceptInvite({
        token,
        full_name: form.full_name,
        email: form.email,
        password: form.password,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to accept this invite. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background font-body-md text-on-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/logo.png" alt="Vyom CRM logo" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary leading-none">Vyom</h1>
            <p className="font-label-md text-label-md text-on-surface-variant mt-0.5 tracking-wide">Fiscal Precision</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-[0_2px_4px_rgba(0,0,0,0.05)]">
          {checking ? (
            <div className="flex items-center justify-center gap-2 py-6 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Checking invite link…
            </div>
          ) : valid ? (
            <>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Join {invite.tenant_name}</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                You have been invited as {ROLE_LABELS[invite.role] || invite.role}. Create your account to get started.
              </p>

              {error && (
                <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-stack-md">
                <div>
                  <label className={labelCls} htmlFor="inv_email">Email</label>
                  <input
                    id="inv_email"
                    type="email"
                    className={`${inputCls} bg-surface-container-low text-on-surface-variant cursor-not-allowed`}
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    required
                    readOnly
                  />
                </div>

                <div>
                  <label className={labelCls} htmlFor="inv_full_name">Full name</label>
                  <input
                    id="inv_full_name"
                    type="text"
                    autoComplete="name"
                    className={inputCls}
                    placeholder="Sarah Johnson"
                    value={form.full_name}
                    onChange={(e) => setField('full_name', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
                  <div>
                    <label className={labelCls} htmlFor="inv_password">Password</label>
                    <div className="relative">
                      <input
                        id="inv_password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        className={`${inputCls} pr-11`}
                        placeholder="Min. 8 characters"
                        value={form.password}
                        onChange={(e) => setField('password', e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-on-surface-variant hover:text-on-surface transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="inv_confirm">Confirm password</label>
                    <input
                      id="inv_confirm"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className={inputCls}
                      placeholder="Repeat password"
                      value={form.confirm}
                      onChange={(e) => setField('confirm', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
                  {loading ? 'Joining workspace…' : 'Join workspace'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Invite unavailable</h2>
              {error && (
                <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">
                  {error}
                </div>
              )}
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                Ask the person who invited you to send you a fresh link.
              </p>
              <Link
                to="/signup"
                className="flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors"
              >
                Create your own workspace
              </Link>
            </>
          )}
        </div>

        <p className="text-center font-body-md text-body-md text-on-surface-variant mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-secondary font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}