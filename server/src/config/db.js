import pkg from 'pg';
const { Pool } = pkg;

// Hardcoded connection string for Supabase
const pool = new Pool({
  connectionString: 'postgresql://postgres.sbfszsyrmowmwlksuhmw:Rocklee%402024@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

// Query helper
const query = (text, params) => pool.query(text, params);

export { pool, query };