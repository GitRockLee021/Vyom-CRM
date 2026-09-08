import nodemailer from 'nodemailer';

// SMTP settings come from server/.env. When SMTP_HOST is empty we run in
// "dev mode": emails are logged to the server console and the caller echoes
// the link back in the API response (used only for local testing).
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM =
  process.env.MAIL_FROM ||
  (SMTP_USER ? `Vyom CRM <${SMTP_USER}>` : 'Vyom CRM <no-reply@vyom.local>');

const isDev = !SMTP_HOST;

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter;
}

export function isMailDevMode() {
  return isDev;
}

function plainText(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function baseHtml({ title, preheader, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f2f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e0e9;">
            <tr>
              <td style="padding:28px 32px 12px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td width="40" style="font-size:0;">
                            <div style="width:40px;height:40px;border-radius:8px;background:#d7ebff;text-align:center;line-height:40px;font-size:20px;">🛡️</div>
                          </td>
                          <td style="padding-left:12px;">
                            <div style="font-size:18px;font-weight:700;color:#0a395f;letter-spacing:0.5px;">Vyom CRM</div>
                            <div style="font-size:11px;color:#757c89;margin-top:2px;letter-spacing:1.5px;">FISCAL PRECISION</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${preheader ? `<tr><td style="padding:8px 32px 0 32px;font-size:11px;color:#757c89;">${preheader}</td></tr>` : ''}
            <tr>${body}</tr>
            <tr>
              <td style="padding:20px 32px 28px 32px;text-align:center;font-size:11px;color:#9a94a6;border-top:1px solid #f0eef4;">
                You are receiving this email because someone took an action on this Vyom CRM account.<br />
                &copy; ${new Date().getFullYear()} Vyom CRM
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendMail({ to, subject, html }) {
  if (isDev) {
    console.log(`[mailer] dev mode (SMTP_HOST not set) — would email ${to}`);
    console.log(`[mailer] subject: ${subject}`);
    console.log(`[mailer] body: ${plainText(html)}`);
    return { dev: true };
  }
  await getTransporter().sendMail({ from: MAIL_FROM, to, subject, html });
  return { dev: false };
}

// Invite a teammate into a workspace.
export function buildInviteEmail({ email, tenantName, roleLabel, inviteUrl }) {
  return baseHtml({
    title: `Join ${tenantName} on Vyom CRM`,
    preheader: `${roleLabel} invited to ${tenantName}.`,
    body: `
      <td style="padding:24px 32px 8px 32px;">
        <h1 style="margin:0 0 12px 0;font-size:20px;color:#1c1b1f;">You're invited to <span style="color:#0a395f;">${tenantName}</span></h1>
        <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#757c89;">
          <strong style="color:#1c1b1f;">${email}</strong> has been invited as <strong style="color:#1c1b1f;">${roleLabel}</strong>.
          Create your account to join the workspace and get started.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
          <tr>
            <td align="center" style="background:#0b6bcb;border-radius:8px;">
              <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Accept Invitation</a>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:12px;color:#9a94a6;line-height:1.5;">
          This link expires in 72 hours. If you weren't expecting this, you can safely ignore this email.
        </p>
      </td>`,
  });
}

export function sendInviteEmail({ email, tenantName, roleLabel, inviteUrl }) {
  return sendMail({
    to: email,
    subject: `You've been invited to ${tenantName} on Vyom CRM`,
    html: buildInviteEmail({ email, tenantName, roleLabel, inviteUrl }),
  });
}

// Password reset for an existing account.
export function buildResetEmail({ email, resetUrl }) {
  return baseHtml({
    title: 'Reset your Vyom CRM password',
    preheader: 'Password reset requested.',
    body: `
      <td style="padding:24px 32px 8px 32px;">
        <h1 style="margin:0 0 12px 0;font-size:20px;color:#1c1b1f;">Reset your password</h1>
        <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#757c89;">
          A password reset was requested for <strong style="color:#1c1b1f;">${email}</strong>.
          If this was you, click the button below. If not, you can safely ignore this email.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
          <tr>
            <td align="center" style="background:#0b6bcb;border-radius:8px;">
              <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Reset Password</a>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:12px;color:#9a94a6;line-height:1.5;">
          This link expires in 1 hour and can only be used once.
        </p>
      </td>`,
  });
}

export function sendResetEmail({ email, resetUrl }) {
  return sendMail({
    to: email,
    subject: 'Reset your Vyom CRM password',
    html: buildResetEmail({ email, resetUrl }),
  });
}

// Payment reminder for an outstanding invoice.
export function buildReminderEmail({ clientName, invoiceNumber, amount, dueDate, companyName }) {
  const total = Number(amount) || 0;
  return baseHtml({
    title: `Reminder: Invoice ${invoiceNumber}`,
    preheader: `Payment reminder for ${invoiceNumber}.`,
    body: `
      <td style="padding:24px 32px 8px 32px;">
        <h1 style="margin:0 0 12px 0;font-size:20px;color:#1c1b1f;">Payment reminder</h1>
        <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#757c89;">
          Dear <strong style="color:#1c1b1f;">${clientName}</strong>,
        </p>
        <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#757c89;">
          This is a gentle reminder that invoice <strong style="color:#1c1b1f;">${invoiceNumber}</strong>
          for <strong style="color:#1c1b1f;">₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          is due${dueDate ? ` on <strong style="color:#1c1b1f;">${new Date(dueDate).toLocaleDateString('en-IN')}</strong>` : ''}.
        </p>
        <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#757c89;">
          If you have already made this payment, please disregard this message. Otherwise, we would appreciate an early settlement.
        </p>
        <p style="margin:0 0 0 0;font-size:14px;line-height:1.6;color:#757c89;">
          Thank you,<br /><strong style="color:#1c1b1f;">${companyName || 'Vyom CRM'}</strong>
        </p>
      </td>`,
  });
}

export function sendReminderEmail({ clientEmail, clientName, invoiceNumber, amount, dueDate, companyName }) {
  return sendMail({
    to: clientEmail,
    subject: `Payment reminder for invoice ${invoiceNumber}`,
    html: buildReminderEmail({ clientName, invoiceNumber, amount, dueDate, companyName }),
  });
}