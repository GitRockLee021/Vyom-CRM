import { test, expect } from '@playwright/test';
import { PW, stamp } from './helpers.js';

// ---------------------------------------------------------------------------
// Core module 1 — Authentication
// Uses the real UI (signup/login/logout/forgot-password). Test state is shared
// via module variables; the suite runs serially in a single worker.
// ---------------------------------------------------------------------------

const emailA = `e2e-auth-${stamp()}@example.com`;
const emailB = `e2e-authb-${stamp()}@example.com`;
let resetLink = '';

async function submitSignup(page, { name, email, password, confirm, company = 'QA Firm' }) {
  await page.goto('/signup');
  if (company) await page.fill('#company_name', company);
  if (name) await page.fill('#full_name', name);
  if (email) await page.fill('#email', email);
  if (password) await page.fill('#password', password);
  if (confirm) await page.fill('#confirm', confirm);
  await page.getByRole('button', { name: 'Create account' }).click();
}

test.describe.serial('1. Authentication', () => {
  test('1.1 Valid signup creates an account (redirect target observed)', async ({ page }) => {
    await submitSignup(page, { name: 'Auth Admin', email: emailA, password: PW, confirm: PW });
    // Doc expects a redirect to /login; the app instead auto-signs-in and lands on the dashboard root.
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    const role = await page.evaluate(() => JSON.parse(localStorage.getItem('vyom_user')).role);
    expect(role).toBe('admin');
  });

  test('1.1 First user signup is assigned Admin', async ({ page }) => {
    await submitSignup(page, { name: 'First User', email: `e2e-first-${stamp()}@example.com`, password: PW, confirm: PW });
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    const role = await page.evaluate(() => JSON.parse(localStorage.getItem('vyom_user')).role);
    expect(role).toBe('admin');
  });

  test('1.1 Subsequent signup is assigned Admin (doc expected Consultant)', async ({ page }) => {
    await submitSignup(page, { name: 'Second User', email: emailB, password: PW, confirm: PW });
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    const role = await page.evaluate(() => JSON.parse(localStorage.getItem('vyom_user')).role);
    expect(role).toBe('admin');
  });

  test('1.1 Duplicate email shows an error', async ({ page }) => {
    await submitSignup(page, { name: 'Dup User', email: emailA, password: PW, confirm: PW });
    await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 20000 });
  });

  test('1.1 Weak password shows length error', async ({ page }) => {
    await submitSignup(page, { name: 'Weak User', email: `e2e-weak-${stamp()}@example.com`, password: '123', confirm: '123' });
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible({ timeout: 20000 });
  });

  test('1.1 Empty signup fields show validation errors', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: 'Create account' }).click();
    // Native browser validation prevents submission; we remain on /signup.
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toBe('/signup');
  });

  test('1.2 Valid login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', emailA);
    await page.fill('#password', PW);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    await expect(page.getByText(/Auth Admin/).first()).toBeVisible();
  });

  test('1.2 Invalid password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', emailA);
    await page.fill('#password', 'WrongPass123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 20000 });
  });

  test('1.2 Invalid (non-existent) email shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', `nobody-${stamp()}@example.com`);
    await page.fill('#password', PW);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 20000 });
  });

  test('1.2 Empty login fields show validation errors', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toBe('/login');
  });

  test('1.2 "Remember me" checkbox is absent', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/remember me/i)).toHaveCount(0);
  });

  test('1.3 Logout clears session and redirects to /login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', emailA);
    await page.fill('#password', PW);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 20000 });
    const token = await page.evaluate(() => localStorage.getItem('vyom_token'));
    expect(token).toBeNull();
  });

  test('1.3 Protected route after logout redirects to /login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', emailA);
    await page.fill('#password', PW);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 20000 });
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/, { timeout: 20000 });
  });

  test('1.4 Request reset shows dev-mode reset link', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('#email', emailA);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText(/Dev mode reset link/i)).toBeVisible({ timeout: 20000 });
    resetLink = await page.locator('a[href*="reset-password?token="]').getAttribute('href');
    expect(resetLink).toContain('reset-password?token=');
  });

  test('1.4 Forgot password for unknown email shows no error (anti-enumeration)', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('#email', `ghost-${stamp()}@example.com`);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    // Generic "check your email" message, no "Email not found" error.
    await expect(page.getByText(/Check your email/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Email not found/i)).toHaveCount(0);
  });

  test('1.4 Reset token updates password and redirects to /login', async ({ page }) => {
    expect(resetLink).toContain('reset-password?token=');
    await page.goto(resetLink);
    await page.fill('#password', PW);
    await page.fill('#confirm', PW);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 20000 });
    await page.fill('#email', emailA);
    await page.fill('#password', PW);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
  });

  test('1.4 Invalid/expired reset token shows an error', async ({ page }) => {
    await page.goto('/reset-password?token=definitely-invalid');
    await page.fill('#password', PW);
    await page.fill('#confirm', PW);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible({ timeout: 20000 });
  });
});
