import { get, post, put } from './client.js';

export function getWhatsAppConfig() {
  return get('/whatsapp/config');
}

export function getWhatsAppSettings() {
  return get('/whatsapp/settings');
}

export function saveWhatsAppSettings(payload) {
  return put('/whatsapp/settings', payload);
}

export function testWhatsAppConnection() {
  return post('/whatsapp/test');
}

export function getWhatsAppMessages(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== '' && v != null)
  ).toString();
  return get(`/whatsapp/messages${qs ? `?${qs}` : ''}`);
}

export function sendInvoiceNotice(invoiceId) {
  return post('/whatsapp/send-invoice', { invoice_id: invoiceId });
}

export function sendOverdueReminder(invoiceId) {
  return post('/whatsapp/send-reminder', { invoice_id: invoiceId });
}

export function sendPaymentConfirmation(paymentId) {
  return post('/whatsapp/send-payment-confirmation', { payment_id: paymentId });
}

export function sendClientMessage(clientId, text) {
  return post('/whatsapp/send-message', { client_id: clientId, text });
}