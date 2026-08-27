import { useState } from 'react';
import { Link } from 'react-router-dom';
import { post } from '../api/client.js';

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder-on-surface-variant focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-colors';
const labelCls = 'block font-label-md text-label-md text-on-surface-variant mb-1.5';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const data = await post('/auth/forgot-password', { email });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Unable to send a reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background font-body-md text-on-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/logo.png" alt="FinConsul logo" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary leading-none">FinConsul</h1>
            <p className="font-label-md text-label-md text-on-surface-variant mt-0.5 tracking-wide">Consulting Portal</p>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-[0_2px_4px_rgba(0,0,0,0.05)]">
          {result ? (
            <>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Check your email</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">{result.message}</p>

              {result.devResetLink && (
                <div className="mb-6 px-3.5 py-3 rounded-lg bg-surface-container-low border border-dashed border-outline-variant">
                  <p className="font-label-md text-label-md text-on-surface-variant mb-1">Dev mode reset link</p>
                  <a href={result.devResetLink} className="font-body-md text-body-md text-secondary hover:underline break-all">
                    {result.devResetLink}
                  </a>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="font-headline-md text-headline-md text-on-surface mb-1">Forgot password?</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                Enter your account email and we&apos;ll send you a link to reset your password.
              </p>

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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center font-body-md text-body-md text-on-surface-variant mt-6">
          Remembered it?{' '}
          <Link to="/login" className="text-secondary font-semibold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}