import { query } from '../config/db.js';

// Compute the next upcoming due date (returned as a YYYY-MM-DD string) for a
// compliance rule. Rules:
//   { type:'monthly', day }        -> day of current/next month (day not yet passed)
//   { type:'nextMonth', day }      -> day of the following month (e.g. TDS by 7th of next month)
//   { type:'annual', month, day }  -> next occurrence of that month/day
//   { type:'qtrEnd24Q' }           -> last day of the month following the current quarter end
//   null / undefined                -> null (no due date)
function nextDueDate(rule) {
  if (!rule) return null;
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-11

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (yy, mm, dd) => `${yy}-${pad(mm + 1)}-${pad(dd)}`;

  if (rule.type === 'monthly') {
    const due = new Date(y, m, rule.day);
    const target = due >= today ? due : new Date(y, m + 1, rule.day);
    return ymd(target.getFullYear(), target.getMonth(), rule.day);
  }

  if (rule.type === 'nextMonth') {
    return ymd(today.getFullYear(), today.getMonth() + 1, rule.day);
  }

  if (rule.type === 'annual') {
    const due = new Date(y, rule.month, rule.day);
    const target = due >= today ? due : new Date(y + 1, rule.month, rule.day);
    return ymd(target.getFullYear(), target.getMonth(), rule.day);
  }

  if (rule.type === 'qtrEnd24Q') {
    // 24Q is due the last day of the month following the quarter end:
    // Q1 (Mar) -> 31 Jul, Q2 (Jun) -> 31 Oct, Q3 (Sep) -> 31 Jan, Q4 (Dec) -> 31 May
    const qEnd = Math.floor(m / 3) * 3 + 2; // month index of current quarter end (2,5,8,11)
    let dueMonth = qEnd + 1; // month following quarter end
    let dueYear = y;
    // If this quarter's filing date has passed, move to next quarter.
    const lastDay = new Date(dueYear, dueMonth + 1, 0).getDate();
    if (new Date(dueYear, dueMonth, lastDay) < today) {
      dueMonth += 3;
      if (dueMonth > 11) { dueMonth -= 12; dueYear += 1; }
    }
    return ymd(dueYear, dueMonth, new Date(dueYear, dueMonth + 1, 0).getDate());
  }

  return null;
}

// Map a service to the compliance tasks that should be generated for a client
// who has opted into it. Returns an array of { title, periodLabel, checklist[], due }.
// Mirrors the front-end `servicePlan` preview in ClientForm.jsx.
function planForService(service) {
  const name = (service.name || '').toLowerCase();

  if (name.includes('gst') && name.includes('filing')) {
    return [
      {
        title: 'File monthly GSTR-3B return',
        periodLabel: 'Monthly',
        due: { type: 'monthly', day: 20 },
        checklist: ['Reconcile GSTR-2B purchases', 'Draft return from books', 'Client review & approval', 'Pay & file on portal'],
      },
      {
        title: 'File monthly GSTR-1 (with HSN summary)',
        periodLabel: 'Monthly',
        due: { type: 'monthly', day: 11 },
        checklist: ['Verify outward sales register', 'Prepare HSN summary', 'File GSTR-1 on portal'],
      },
    ];
  }
  if (name.includes('tds') || name.includes('tcs')) {
    return [
      {
        title: 'File quarterly TDS return (24Q)',
        periodLabel: 'Quarterly',
        due: { type: 'qtrEnd24Q' },
        checklist: ['Reconcile TDS challans', 'Prepare 24Q statement', 'File & issue Form 16A'],
      },
      {
        title: 'Deposit monthly TDS/TCS',
        periodLabel: 'Monthly',
        due: { type: 'nextMonth', day: 7 },
        checklist: ['Collect deductor data', 'Generate challan', 'Confirm deposit'],
      },
    ];
  }
  if (name.includes('itr') || name.includes('income tax') || name.includes('tax return')) {
    return [
      {
        title: 'Prepare & file Income Tax Return',
        periodLabel: 'Annual · AY 2026-27',
        due: { type: 'annual', month: 6, day: 31 }, // 31 July
        checklist: ['Gather Form 26AS / AIS', 'Reconcile income & TDS', 'Draft return', 'Client approval', 'E-file & acknowledge'],
      },
    ];
  }
  if (name.includes('statutory audit')) {
    return [
      {
        title: 'Statutory audit — draft financial statements',
        periodLabel: 'Annual · FY 2025-26',
        due: { type: 'annual', month: 8, day: 30 }, // 30 Sep
        checklist: ['Plan & risk assessment', 'Fieldwork / vouching', 'Draft financial statements', 'Review', 'Issue audit report'],
      },
    ];
  }
  if (name.includes('tax audit')) {
    return [
      {
        title: 'Tax audit — Form 3CA/3CB & 3CD',
        periodLabel: 'Annual · AY 2026-27',
        due: { type: 'annual', month: 8, day: 30 }, // 30 Sep
        checklist: ['Finalise accounts', 'Prepare 3CD clauses', 'Sign off audit report'],
      },
    ];
  }
  if (name.includes('roc') || name.includes('secretarial') || name.includes('incorporation')) {
    return [
      {
        title: 'ROC compliance — AOC-4 & MGT-7',
        periodLabel: 'Annual · due 31 Oct',
        due: { type: 'annual', month: 9, day: 31 }, // 31 Oct
        checklist: ['Finalise annual accounts', 'Prepare boards’ report', 'File AOC-4', 'File MGT-7'],
      },
    ];
  }
  if (name.includes('bookkeeping')) {
    return [
      {
        title: 'Monthly bookkeeping — books close',
        periodLabel: 'Monthly · 5th',
        due: { type: 'nextMonth', day: 5 },
        checklist: ['Fetch bank statements', 'Post entries & reconciliations', 'Share updated books'],
      },
    ];
  }
  if (name.includes('payroll')) {
    return [
      {
        title: 'Monthly payroll processing',
        periodLabel: 'Monthly · 28th',
        due: { type: 'monthly', day: 28 },
        checklist: ['Collect attendance/records', 'Compute salaries & TDS', 'Generate payslips & challans'],
      },
    ];
  }
  if (name.includes('financial statement')) {
    return [
      {
        title: 'Prepare annual financial statements',
        periodLabel: 'Annual · per FY',
        due: { type: 'annual', month: 3, day: 30 }, // 30 Apr (post FY close)
        checklist: ['Finalise trial balance', 'Draft financial statements', 'Management review'],
      },
    ];
  }

  // Generic fallback for any other service.
  return [
    {
      title: `${service.name} — compliance work`,
      periodLabel: service.is_recurring ? 'Recurring' : 'One-off',
      due: null,
      checklist: [],
    },
  ];
}

// Find or create the engagement for a client + service (one per client/service).
export async function ensureEngagement(clientId, service, tenantId) {
  let { rows } = await query(
    'SELECT * FROM engagements WHERE client_id = $1 AND service_id = $2 LIMIT 1',
    [clientId, service.id]
  );
  if (rows[0]) return rows[0];

  ({ rows } = await query(
    `INSERT INTO engagements (client_id, service_id, title, period, tenant_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [clientId, service.id, service.name, 'FY 2026-27', tenantId]
  ));
  return rows[0];
}

// Generate compliance tasks for a client's opted-in service. Idempotent: won't
// create a duplicate for the same engagement+period (or title).
export async function generateTasksForService(clientId, service, tenantId, actorUserId = null) {
  const engagement = await ensureEngagement(clientId, service, tenantId);
  const plans = planForService(service);
  const created = [];

  for (const plan of plans) {
    const existing = await query(
      `SELECT id FROM tasks
       WHERE engagement_id = $1 AND period = $2 AND title = $3`,
      [engagement.id, plan.periodLabel, plan.title]
    );
    if (existing.rows[0]) continue;

    const { rows } = await query(
      `INSERT INTO tasks (tenant_id, client_id, engagement_id, title, period, status, due_date)
       VALUES ($1, $2, $3, $4, $5, 'todo', $6)
       RETURNING *`,
      [tenantId, clientId, engagement.id, plan.title, plan.periodLabel, nextDueDate(plan.due)]
    );
    const task = rows[0];

    // Seed default checklist items.
    for (let i = 0; i < plan.checklist.length; i++) {
      await query(
        `INSERT INTO task_checklist_items (task_id, title, position) VALUES ($1, $2, $3)`,
        [task.id, plan.checklist[i], i]
      );
    }

    if (actorUserId) {
      await query(
        `INSERT INTO task_activity (task_id, user_id, action, details)
         VALUES ($1, $2, 'created', $3::jsonb)`,
        [task.id, actorUserId, JSON.stringify({ source: 'service', service: service.name })]
      );
    }

    created.push(task.id);
  }

  return created;
}

// Fully synchronize the tasks for one client: generate tasks for all opted-in
// services, and (soft) flag tasks whose service is no longer opted in.
// Returns the set of newly created task ids.
export async function syncTasksForClient(clientId, tenantId, actorUserId = null) {
  const { rows: opted } = await query(
    `SELECT cs.service_id, s.* FROM client_services cs
     JOIN services s ON s.id = cs.service_id
     WHERE cs.client_id = $1`,
    [clientId]
  );
  const optedIds = new Set(opted.map((o) => o.service_id));
  const created = [];

  for (const service of opted) {
    const ids = await generateTasksForService(clientId, service, tenantId, actorUserId);
    created.push(...ids);
  }

  // Flag tasks for review where the linked engagement's service is no longer
  // opted into by the client (only affects still-open tasks).
  const { rows: stale } = await query(
    `SELECT t.id, t.service_title FROM (
       SELECT t.id, e.service_id, s.name AS service_title
       FROM tasks t
       JOIN engagements e ON e.id = t.engagement_id
       LEFT JOIN services s ON s.id = e.service_id
       WHERE t.client_id = $1
     ) t
     WHERE t.id NOT IN (
       SELECT t2.id FROM tasks t2
       JOIN engagements e2 ON e2.id = t2.engagement_id
       WHERE t2.client_id = $1 AND e2.service_id = ANY($2::uuid[])
     )`,
    [clientId, [...optedIds]]
  );
  for (const task of stale) {
    await query(
      `UPDATE tasks SET removed_at = COALESCE(removed_at, now()), removed_by = COALESCE(removed_by, $3), removed_reason = $2,
               status = CASE WHEN status = 'done' THEN status ELSE 'todo' END
       WHERE id = $1`,
      [task.id, `Service "${task.service_title}" removed from client`, actorUserId ?? null]
    );
    if (actorUserId) {
      await query(
        `INSERT INTO task_activity (task_id, user_id, action, details)
         VALUES ($1, $2, 'service_removed', $3::jsonb)`,
        [task.id, actorUserId, JSON.stringify({ service: task.service_title, flagged: true })]
      );
    }
  }

  return created;
}
