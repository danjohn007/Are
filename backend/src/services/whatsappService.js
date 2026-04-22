import twilio from 'twilio';
import env from '../config/env.js';
import logger from '../config/logger.js';

const client = env.twilioSid && env.twilioToken ? twilio(env.twilioSid, env.twilioToken) : null;

export async function sendWhatsAppMessage(to, body) {
  if (!client || !env.twilioWhatsappFrom) {
    logger.info('Twilio not configured, skipping WhatsApp message');
    return null;
  }

  return client.messages.create({
    from: env.twilioWhatsappFrom,
    to,
    body
  });
}
