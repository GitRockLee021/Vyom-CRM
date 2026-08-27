import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder-on-surface-variant focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors';
const labelCls = 'block font-label-md text-label-md text-on-surface-variant mb-1.5';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location?.state?.notice;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user?.role === 'admin' ? '/' : '/', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please try again.');
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
          <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Welcome back</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6">Sign in to your account to continue.</p>

          {notice && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-secondary-fixed text-on-secondary-fixed font-body-md text-body-md">
              {notice}
            </div>
          )}

          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-stack-md">
            <div>
              <label className={labelCls} htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={inputCls}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="password">Password</label>
                <Link to="/forgot-password" className="font-label-md text-label-md text-secondary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`${inputCls} pr-11`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center font-body-md text-body-md text-on-surface-variant mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-secondary font-semibold hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
