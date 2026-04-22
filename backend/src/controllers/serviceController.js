import * as serviceModel from '../models/serviceModel.js';
import { getPagination, getMeta } from '../utils/pagination.js';
import { generateServicePdf } from '../services/pdfService.js';

export async function createService(req, res) {
  const service = await serviceModel.createService(req.body);
  return res.status(201).json({ success: true, data: service });
}

export async function getServices(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const result = await serviceModel.listServices({ limit, offset });
  return res.status(200).json({
    success: true,
    data: result.data,
    meta: getMeta(result.total, page, limit)
  });
}

export async function getServiceById(req, res) {
  const service = await serviceModel.getServiceById(req.params.id);
  if (!service) {
    return res.status(404).json({ success: false, message: 'Service not found' });
  }
  return res.status(200).json({ success: true, data: service });
}

export async function updateService(req, res) {
  const service = await serviceModel.updateService(req.params.id, req.body);
  if (!service) {
    return res.status(404).json({ success: false, message: 'Service not found' });
  }
  return res.status(200).json({ success: true, data: service });
}

export async function deleteService(req, res) {
  const deleted = await serviceModel.deleteService(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Service not found' });
  }
  return res.status(200).json({ success: true, message: 'Service deleted' });
}

export async function exportServicePdf(req, res) {
  const service = await serviceModel.getServiceById(req.params.id);
  if (!service) {
    return res.status(404).json({ success: false, message: 'Service not found' });
  }

  const buffer = await generateServicePdf(service);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=service-${service.id}.pdf`);
  return res.send(buffer);
}
