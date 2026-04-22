import { pool } from '../config/db.js';

export async function createProperty(data) {
  const query = `
    INSERT INTO properties (tokko_id, title, description, price, address, city, bedrooms, bathrooms, area, image_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
  `;
  const values = [
    data.tokko_id || null,
    data.title,
    data.description,
    data.price,
    data.address,
    data.city,
    data.bedrooms,
    data.bathrooms,
    data.area,
    data.image_url
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function upsertByTokkoId(data) {
  const query = `
    INSERT INTO properties (tokko_id, title, description, price, address, city, bedrooms, bathrooms, area, image_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (tokko_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      bedrooms = EXCLUDED.bedrooms,
      bathrooms = EXCLUDED.bathrooms,
      area = EXCLUDED.area,
      image_url = EXCLUDED.image_url,
      updated_at = NOW()
    RETURNING *
  `;
  const values = [
    data.tokko_id,
    data.title,
    data.description,
    data.price,
    data.address,
    data.city,
    data.bedrooms,
    data.bathrooms,
    data.area,
    data.image_url
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function listProperties({ limit, offset, city }) {
  const filters = [];
  const values = [];

  if (city) {
    values.push(city);
    filters.push(`city ILIKE $${values.length}`);
    values[values.length - 1] = `%${city}%`;
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  values.push(limit, offset);
  const limitIndex = values.length - 1;
  const offsetIndex = values.length;

  const dataQuery = `SELECT * FROM properties ${where} ORDER BY created_at DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
  const countQuery = `SELECT COUNT(*)::int AS total FROM properties ${where}`;

  const [{ rows }, countResult] = await Promise.all([
    pool.query(dataQuery, values),
    pool.query(countQuery, values.slice(0, values.length - 2))
  ]);

  return { data: rows, total: countResult.rows[0].total };
}

export async function getPropertyById(id) {
  const { rows } = await pool.query('SELECT * FROM properties WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

export async function updateProperty(id, data) {
  const query = `
    UPDATE properties
    SET title = $1, description = $2, price = $3, address = $4, city = $5,
        bedrooms = $6, bathrooms = $7, area = $8, image_url = $9, updated_at = NOW()
    WHERE id = $10
    RETURNING *
  `;
  const values = [
    data.title,
    data.description,
    data.price,
    data.address,
    data.city,
    data.bedrooms,
    data.bathrooms,
    data.area,
    data.image_url,
    id
  ];
  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

export async function deleteProperty(id) {
  const { rowCount } = await pool.query('DELETE FROM properties WHERE id = $1', [id]);
  return rowCount > 0;
}
