import pkg from 'pg';
const { Pool } = pkg;

const connectionString = (process.env.DATABASE_URL || '').trim();

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it to .env or the hosting platform.');
}

function describeTarget(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host || '(missing host)'}${parsed.pathname || ''}`;
  } catch {
    return url;
  }
}

console.log(`[db] connecting to ${describeTarget(connectionString)}`);

const pool = new Pool({
  connectionString,
  max: parseInt(process.env.PG_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

// Query helper
const query = (text, params) => pool.query(text, params);

// Auto-migrate: ensure client_services table exists (idempotent).
async function autoMigrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_services (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (client_id, service_id)
      );
      CREATE INDEX IF NOT EXISTS idx_client_services_client ON client_services (client_id);
      CREATE INDEX IF NOT EXISTS idx_client_services_service ON client_services (service_id);

      CREATE TABLE IF NOT EXISTS wa_messages (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     INTEGER NOT NULL,
        direction     VARCHAR(10) NOT NULL DEFAULT 'outbound'
                      CHECK (direction IN ('outbound', 'inbound')),
        wa_message_id VARCHAR(64),
        phone_number  VARCHAR(20) NOT NULL,
        client_id     UUID,
        template_name VARCHAR(64),
        body          TEXT,
        status        VARCHAR(30) NOT NULL DEFAULT 'pending',
        error         TEXT,
        meta          JSONB,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_wa_messages_tenant ON wa_messages (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON wa_messages (phone_number);
      CREATE INDEX IF NOT EXISTS idx_wa_messages_client ON wa_messages (client_id);

      -- Tasks module additions (idempotent).
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS period VARCHAR(80);
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS removed_reason TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_note TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks (client_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
      CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks (due_date);

      CREATE TABLE IF NOT EXISTS task_checklist_items (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        title      VARCHAR(200) NOT NULL,
        is_done    BOOLEAN NOT NULL DEFAULT FALSE,
        position   INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_tci_task ON task_checklist_items (task_id);

      CREATE TABLE IF NOT EXISTS task_comments (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
        body       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_tc_task ON task_comments (task_id);

      CREATE TABLE IF NOT EXISTS task_activity (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
        action     VARCHAR(60) NOT NULL,
        details    JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_ta_task ON task_activity (task_id);

      -- Backfill assignee for tasks that carry no assignee but have a "created"
      -- activity record (assign to the user who created the task). Idempotent:
      -- only touches rows where assigned_to is still NULL.
      UPDATE tasks t
      SET assigned_to = a.user_id
      FROM (
        SELECT DISTINCT ON (task_id) task_id, user_id
        FROM task_activity
        WHERE action = 'created' AND user_id IS NOT NULL
        ORDER BY task_id, created_at ASC
      ) a
      WHERE t.id = a.task_id AND t.assigned_to IS NULL;

      -- Fallback: any task still without an assignee gets claimed by the
      -- tenant's owner (earliest admin). Idempotent — only unassigned rows.
      UPDATE tasks t
      SET assigned_to = u.id
      FROM (
        SELECT DISTINCT ON (tenant_id) tenant_id, id
        FROM users
        WHERE role = 'admin'
        ORDER BY tenant_id, created_at ASC
      ) u
      WHERE t.tenant_id = u.tenant_id AND t.assigned_to IS NULL;
    `);
    console.log('[db] client_services, wa_messages and tasks-module tables ensured');
  } catch (err) {
    console.error('[db] auto-migrate warning:', err.message);
  }
}

autoMigrate();

export { pool, query };