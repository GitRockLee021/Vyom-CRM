import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { post } from '../api/client.js';

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder-on-surface-variant focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors';
const labelCls = 'block font-label-md text-label-md text-on-surface-variant mb-1.5';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('This reset link is invalid. Please request a new one.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await post('/auth/reset-password', { token, new_password: password });
      navigate('/login', { replace: true, state: { notice: 'Your password has been reset. Please sign in.' } });
    } catch (err) {
      setError(err.message || 'Unable to reset your password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background font-body-md text-on-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/logo.png" alt="Vyom CRM logo" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary leading-none">Vyom</h1>
            <p className="font-label-md text-label-md text-on-surface-variant mt-0.5 tracking-wide">Fiscal Precision</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-card">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Set a new password</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6">
            Choose a new password for your account. It must be at least 8 characters.
          </p>

          {error && (
            <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-error-container text-on-error-container font-body-md text-body-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-stack-md">
            <div>
              <label className={labelCls} htmlFor="password">New password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`${inputCls} pr-11`}
                  placeholder="Min. 8 characters"
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

            <div>
              <label className={labelCls} htmlFor="confirm">Confirm new password</label>
              <input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className={inputCls}
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
              {loading ? 'Saving…' : 'Reset password'}
            </button>
          </form>
        </div>

        <p className="text-center font-body-md text-body-md text-on-surface-variant mt-6">
          <Link to="/login" className="text-secondary font-semibold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}