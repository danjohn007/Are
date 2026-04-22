import * as leadModel from '../models/leadModel.js';

export async function getDashboardMetrics(_req, res) {
  const metrics = await leadModel.getLeadMetrics();
  return res.status(200).json({ success: true, data: metrics });
}
