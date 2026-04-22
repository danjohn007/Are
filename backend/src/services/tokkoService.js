import axios from 'axios';
import env from '../config/env.js';
import logger from '../config/logger.js';
import * as propertyModel from '../models/propertyModel.js';

export async function syncTokkoProperties() {
  if (!env.tokkoApiUrl || !env.tokkoApiKey) {
    logger.info('Tokko API is not configured. Skipping sync job.');
    return { synced: 0, skipped: true };
  }

  const response = await axios.get(env.tokkoApiUrl, {
    params: {
      key: env.tokkoApiKey
    },
    timeout: 15000
  });

  const properties = response.data?.objects || response.data?.results || [];
  let synced = 0;

  for (const item of properties) {
    const data = {
      tokko_id: String(item.id),
      title: item.publication_title || item.title || 'Property',
      description: item.description || '',
      price: Number(item.operations?.[0]?.prices?.[0]?.price || 0),
      address: item.address || '',
      city: item.location?.name || item.location || '',
      bedrooms: Number(item.room_amount || 0),
      bathrooms: Number(item.bathroom_amount || 0),
      area: Number(item.surface || 0),
      image_url: item.photos?.[0]?.image || ''
    };

    await propertyModel.upsertByTokkoId(data);
    synced += 1;
  }

  logger.info('Tokko sync completed', { synced });
  return { synced, skipped: false };
}
