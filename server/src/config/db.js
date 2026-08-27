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

export { pool, query };