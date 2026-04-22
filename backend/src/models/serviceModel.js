import { pool } from '../config/db.js';

export async function createService(data) {
  const query = `
    INSERT INTO services (name, slug, description, price, form_schema)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const values = [data.name, data.slug, data.description, data.price, data.form_schema || null];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function listServices({ limit, offset }) {
  const dataQuery = 'SELECT * FROM services ORDER BY created_at DESC LIMIT $1 OFFSET $2';
  const countQuery = 'SELECT COUNT(*)::int AS total FROM services';
  const [{ rows }, countResult] = await Promise.all([
    pool.query(dataQuery, [limit, offset]),
    pool.query(countQuery)
  ]);
  return { data: rows, total: countResult.rows[0].total };
}

export async function getServiceById(id) {
  const { rows } = await pool.query('SELECT * FROM services WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

export async function updateService(id, data) {
  const query = `
    UPDATE services
    SET name = $1, slug = $2, description = $3, price = $4, form_schema = $5, updated_at = NOW()
    WHERE id = $6
    RETURNING *
  `;
  const values = [data.name, data.slug, data.description, data.price, data.form_schema || null, id];
  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

export async function deleteService(id) {
  const { rowCount } = await pool.query('DELETE FROM services WHERE id = $1', [id]);
  return rowCount > 0;
}
