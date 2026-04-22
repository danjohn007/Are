import { pool } from '../config/db.js';

export async function createLead(data) {
  const query = `
    INSERT INTO leads (
      name,
      email_encrypted,
      phone_encrypted,
      message,
      service_id,
      property_id,
      status,
      source,
      extra_data
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  const values = [
    data.name,
    data.email_encrypted,
    data.phone_encrypted,
    data.message,
    data.service_id,
    data.property_id,
    data.status || 'new',
    data.source || 'web',
    data.extra_data || null
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function listLeads({ limit, offset, status }) {
  const filters = [];
  const values = [];

  if (status) {
    values.push(status);
    filters.push(`status = $${values.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  values.push(limit, offset);
  const limitIndex = values.length - 1;
  const offsetIndex = values.length;

  const dataQuery = `
    SELECT l.*, s.name AS service_name
    FROM leads l
    LEFT JOIN services s ON s.id = l.service_id
    ${where}
    ORDER BY l.created_at DESC
    LIMIT $${limitIndex} OFFSET $${offsetIndex}
  `;

  const countQuery = `SELECT COUNT(*)::int AS total FROM leads ${where}`;

  const [{ rows }, countResult] = await Promise.all([
    pool.query(dataQuery, values),
    pool.query(countQuery, values.slice(0, values.length - 2))
  ]);

  return { data: rows, total: countResult.rows[0].total };
}

export async function getLeadById(id) {
  const query = `
    SELECT l.*, s.name AS service_name
    FROM leads l
    LEFT JOIN services s ON s.id = l.service_id
    WHERE l.id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
}

export async function updateLead(id, data) {
  const query = `
    UPDATE leads
    SET
      name = $1,
      email_encrypted = $2,
      phone_encrypted = $3,
      message = $4,
      service_id = $5,
      property_id = $6,
      status = $7,
      source = $8,
      extra_data = $9,
      updated_at = NOW()
    WHERE id = $10
    RETURNING *
  `;

  const values = [
    data.name,
    data.email_encrypted,
    data.phone_encrypted,
    data.message,
    data.service_id,
    data.property_id,
    data.status,
    data.source,
    data.extra_data || null,
    id
  ];

  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

export async function deleteLead(id) {
  const { rowCount } = await pool.query('DELETE FROM leads WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function getLeadMetrics() {
  const query = `
    SELECT
      (SELECT COUNT(*)::int FROM leads) AS total,
      (SELECT COUNT(*)::int FROM leads WHERE status = 'new') AS new_count,
      (SELECT COUNT(*)::int FROM leads WHERE status = 'contacted') AS contacted_count,
      (SELECT COUNT(*)::int FROM leads WHERE status = 'closed') AS closed_count
  `;

  const byServiceQuery = `
    SELECT s.name, COUNT(l.id)::int AS total
    FROM services s
    LEFT JOIN leads l ON l.service_id = s.id
    GROUP BY s.name
    ORDER BY total DESC
  `;

  const latestQuery = `
    SELECT id, name, status, created_at
    FROM leads
    ORDER BY created_at DESC
    LIMIT 5
  `;

  const [totalsResult, byServiceResult, latestResult] = await Promise.all([
    pool.query(query),
    pool.query(byServiceQuery),
    pool.query(latestQuery)
  ]);

  return {
    totals: totalsResult.rows[0],
    byService: byServiceResult.rows,
    latest: latestResult.rows
  };
}
