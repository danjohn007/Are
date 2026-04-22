import { pool } from '../config/db.js';

export async function findByEmail(email) {
  const query = 'SELECT id, name, email, password_hash, role FROM users WHERE email = $1 LIMIT 1';
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
}

export async function findById(id) {
  const query = 'SELECT id, name, email, role, created_at FROM users WHERE id = $1 LIMIT 1';
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
}
