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
    `);
    console.log('[db] client_services table ensured');
  } catch (err) {
    console.error('[db] auto-migrate warning:', err.message);
  }
}

autoMigrate();

export { pool, query };