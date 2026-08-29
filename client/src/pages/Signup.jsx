import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder-on-surface-variant focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors';
const labelCls = 'block font-label-md text-label-md text-on-surface-variant mb-1.5';

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '', company_name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
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
      await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        company_name: form.company_name,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to create your account. Please try again.');
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
          <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Create your workspace</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6">
            Your first account sets up a new workspace and becomes its administrator.
          </p>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-stack-md">
            <div>
              <label className={labelCls} htmlFor="company_name">Firm / company name</label>
              <input
                id="company_name"
                type="text"
                className={inputCls}
                placeholder="e.g. Vyom & Associates"
                value={form.company_name}
                onChange={(e) => setField('company_name', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="full_name">Full name</label>
              <input
                id="full_name"
                type="text"
                autoComplete="name"
                className={inputCls}
                placeholder="Sarah Johnson"
                value={form.full_name}
                onChange={(e) => setField('full_name', e.target.value)}
                required
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={inputCls}
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
              <div>
                <label className={labelCls} htmlFor="password">Password</label>
                <div className="relative">
                  <input
                    id="password"
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
                <label className={labelCls} htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
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
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
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
