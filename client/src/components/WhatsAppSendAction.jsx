import { useState } from 'react';

export default function WhatsAppSendAction({
  kind = 'icon',
  label = 'WhatsApp',
  title,
  confirmText,
  onSend,
  onDone,
  disabled = false,
  className = '',
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const result = await onSend();
      onDone?.(result?.message || 'Message sent successfully.');
    } catch (err) {
      onDone?.(err.message || 'WhatsApp send failed.', false);
    } finally {
      setBusy(false);
    }
  }

  if (kind === 'button') {
    return (
      <button
        type="button"
        disabled={busy || disabled}
        onClick={handleClick}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-label-md text-label-md text-white bg-[#25D366] hover:bg-[#1DA851] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${className}`}
      >
        <span className={`material-symbols-outlined text-[18px] ${busy ? 'animate-spin' : ''}`}>
          {busy ? 'progress_activity' : 'chat'}
        </span>
        {busy ? 'Sending…' : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={handleClick}
      title={title || (busy ? 'Sending…' : 'Send via WhatsApp')}
      className={`text-[#128C7E] hover:text-[#075E54] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      <span className={`material-symbols-outlined text-[18px] ${busy ? 'animate-spin' : ''}`}>
        {busy ? 'progress_activity' : 'chat'}
      </span>
    </button>
  );
}