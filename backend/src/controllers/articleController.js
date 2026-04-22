import * as articleModel from '../models/articleModel.js';
import { getPagination, getMeta } from '../utils/pagination.js';

export async function createArticle(req, res) {
  const article = await articleModel.createArticle(req.body);
  return res.status(201).json({ success: true, data: article });
}

export async function getArticles(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const result = await articleModel.listArticles({ limit, offset });
  return res.status(200).json({
    success: true,
    data: result.data,
    meta: getMeta(result.total, page, limit)
  });
}

export async function getArticleById(req, res) {
  const article = await articleModel.getArticleById(req.params.id);
  if (!article) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }
  return res.status(200).json({ success: true, data: article });
}

export async function updateArticle(req, res) {
  const article = await articleModel.updateArticle(req.params.id, req.body);
  if (!article) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }
  return res.status(200).json({ success: true, data: article });
}

export async function deleteArticle(req, res) {
  const deleted = await articleModel.deleteArticle(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }
  return res.status(200).json({ success: true, message: 'Article deleted' });
}
