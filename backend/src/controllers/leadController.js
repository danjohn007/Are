import * as leadModel from '../models/leadModel.js';
import * as serviceModel from '../models/serviceModel.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { getPagination, getMeta } from '../utils/pagination.js';
import { sendLeadNotification } from '../services/emailService.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';

function mapLead(lead) {
  return {
    ...lead,
    email: decrypt(lead.email_encrypted),
    phone: decrypt(lead.phone_encrypted)
  };
}

export async function createLead(req, res) {
  const payload = {
    ...req.body,
    email_encrypted: encrypt(req.body.email),
    phone_encrypted: encrypt(req.body.phone)
  };

  const lead = await leadModel.createLead(payload);
  const mapped = mapLead(lead);

  const service = lead.service_id ? await serviceModel.getServiceById(lead.service_id) : null;
  await sendLeadNotification({
    serviceName: service?.name,
    leadName: mapped.name,
    leadEmail: mapped.email
  });

  if (mapped.phone) {
    const phone = mapped.phone.startsWith('whatsapp:') ? mapped.phone : `whatsapp:${mapped.phone}`;
    await sendWhatsAppMessage(phone, `Hi ${mapped.name}, we received your request. We will contact you soon.`);
  }

  return res.status(201).json({ success: true, data: mapped });
}

export async function getLeads(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const result = await leadModel.listLeads({
    limit,
    offset,
    status: req.query.status
  });

  return res.status(200).json({
    success: true,
    data: result.data.map(mapLead),
    meta: getMeta(result.total, page, limit)
  });
}

export async function getLeadById(req, res) {
  const lead = await leadModel.getLeadById(req.params.id);
  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }

  return res.status(200).json({ success: true, data: mapLead(lead) });
}

export async function updateLead(req, res) {
  const payload = {
    ...req.body,
    email_encrypted: encrypt(req.body.email),
    phone_encrypted: encrypt(req.body.phone)
  };
  const lead = await leadModel.updateLead(req.params.id, payload);

  if (!lead) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }

  return res.status(200).json({ success: true, data: mapLead(lead) });
}

export async function deleteLead(req, res) {
  const deleted = await leadModel.deleteLead(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Lead not found' });
  }

  return res.status(200).json({ success: true, message: 'Lead deleted' });
}
