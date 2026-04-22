import { pool } from '../config/db.js';

export async function createArticle(data) {
  const query = `
    INSERT INTO articles (title, slug, excerpt, content, image_url, published)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const values = [data.title, data.slug, data.excerpt, data.content, data.image_url, data.published ?? true];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

export async function listArticles({ limit, offset }) {
  const dataQuery = 'SELECT * FROM articles ORDER BY created_at DESC LIMIT $1 OFFSET $2';
  const countQuery = 'SELECT COUNT(*)::int AS total FROM articles';
  const [{ rows }, countResult] = await Promise.all([
    pool.query(dataQuery, [limit, offset]),
    pool.query(countQuery)
  ]);
  return { data: rows, total: countResult.rows[0].total };
}

export async function getArticleById(id) {
  const { rows } = await pool.query('SELECT * FROM articles WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}

export async function updateArticle(id, data) {
  const query = `
    UPDATE articles
    SET title = $1, slug = $2, excerpt = $3, content = $4, image_url = $5, published = $6, updated_at = NOW()
    WHERE id = $7
    RETURNING *
  `;
  const values = [data.title, data.slug, data.excerpt, data.content, data.image_url, data.published ?? true, id];
  const { rows } = await pool.query(query, values);
  return rows[0] || null;
}

export async function deleteArticle(id) {
  const { rowCount } = await pool.query('DELETE FROM articles WHERE id = $1', [id]);
  return rowCount > 0;
}
