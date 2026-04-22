import pg from 'pg';
import env from './env.js';
import logger from './logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl
});

pool.on('error', (error) => {
  logger.error('Unexpected database error', { message: error.message, stack: error.stack });
});

export async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    logger.info('Database connection established');
  } finally {
    client.release();
  }
}
