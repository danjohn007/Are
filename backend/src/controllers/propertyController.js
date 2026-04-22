import * as propertyModel from '../models/propertyModel.js';
import { getPagination, getMeta } from '../utils/pagination.js';
import { syncTokkoProperties } from '../services/tokkoService.js';

export async function createProperty(req, res) {
  const property = await propertyModel.createProperty(req.body);
  return res.status(201).json({ success: true, data: property });
}

export async function getProperties(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const result = await propertyModel.listProperties({
    limit,
    offset,
    city: req.query.city
  });

  return res.status(200).json({
    success: true,
    data: result.data,
    meta: getMeta(result.total, page, limit)
  });
}

export async function getPropertyById(req, res) {
  const property = await propertyModel.getPropertyById(req.params.id);
  if (!property) {
    return res.status(404).json({ success: false, message: 'Property not found' });
  }
  return res.status(200).json({ success: true, data: property });
}

export async function updateProperty(req, res) {
  const property = await propertyModel.updateProperty(req.params.id, req.body);
  if (!property) {
    return res.status(404).json({ success: false, message: 'Property not found' });
  }
  return res.status(200).json({ success: true, data: property });
}

export async function deleteProperty(req, res) {
  const deleted = await propertyModel.deleteProperty(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Property not found' });
  }
  return res.status(200).json({ success: true, message: 'Property deleted' });
}

export async function manualTokkoSync(_req, res) {
  const result = await syncTokkoProperties();
  return res.status(200).json({ success: true, data: result });
}
