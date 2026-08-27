import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      service: 'FinConsul API',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
