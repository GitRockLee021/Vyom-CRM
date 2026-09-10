import { Router } from 'express';
import { query } from '../config/db.js';
import { requirePerm } from '../middleware/auth.middleware.js';

const router = Router();

function withGst(amount, gstRate) {
  return Number(amount) * (1 + Number(gstRate ?? 0) / 100);
}

router.get('/summary', requirePerm('billing.view'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    // --- Clients / Revenue / Invoices (independent queries, run in parallel) ---
    const [clients, revenue, invoices] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE created_at >= $2)::int AS this_month,
                COUNT(*) FILTER (WHERE created_at >= $3 AND created_at < $2)::int AS last_month
         FROM clients
         WHERE tenant_id = $1`,
        [tenantId, monthStart, prevMonthStart],
      ),
      query(
        `SELECT COALESCE(SUM(i.amount * (1 + i.gst_rate / 100)), 0)::numeric AS revenue,
                COUNT(DISTINCT i.client_id)::int AS client_count
         FROM invoices i
         JOIN payments p ON p.invoice_id = i.id
         WHERE p.paid_at >= $2 AND i.status IN ('paid', 'sent', 'overdue') AND i.tenant_id = $1`,
        [tenantId, monthStart],
      ),
      query(`
        SELECT i.id, i.amount, i.gst_rate, i.status, i.due_date
        FROM invoices i
        WHERE i.tenant_id = $1
      `, [tenantId]),
    ]);

    const totalClients = clients.rows[0].total;
    const thisMonthClients = clients.rows[0].this_month;
    const lastMonthClients = clients.rows[0].last_month;
    const clientDelta = lastMonthClients
      ? (thisMonthClients / totalClients) * 100
      : thisMonthClients
        ? 100
        : 0;

    const revenueMtd = Number(revenue.rows[0].revenue);
    const revenueClientCount = revenue.rows[0].client_count;

    let pendingTotal = 0;
    let pending30 = 0;
    let pending30Plus = 0;
    let overdueTotal = 0;
    let overdueCount = 0;

    for (const inv of invoices.rows) {
      const total = withGst(inv.amount, inv.gst_rate);
      if (inv.status === 'overdue' || (inv.status === 'sent' && inv.due_date && new Date(inv.due_date) < now)) {
        overdueTotal += total;
        overdueCount += 1;
      }
      if (inv.status === 'sent' || inv.status === 'draft') {
        pendingTotal += total;
        if (inv.due_date && new Date(inv.due_date) < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
          pending30 += total;
        } else {
          pending30Plus += total;
        }
      }
    }

    res.json({
      period: {
        label: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`,
        range: now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      },
      totalClients,
      clientDelta: Math.round(clientDelta * 10) / 10,
      revenueMtd,
      revenueClientCount,
      pendingTotal,
      pending30,
      pending30Plus,
      overdueTotal,
      overdueCount,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
