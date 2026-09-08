import { get, post } from './client.js';

export function getWhatsAppConfig() {
  return get('/whatsapp/config');
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