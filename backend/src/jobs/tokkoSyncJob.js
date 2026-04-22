import cron from 'node-cron';
import logger from '../config/logger.js';
import { syncTokkoProperties } from '../services/tokkoService.js';

export function startTokkoSyncJob() {
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await syncTokkoProperties();
      logger.info('Hourly Tokko sync completed', result);
    } catch (error) {
      logger.error('Hourly Tokko sync failed', { message: error.message, stack: error.stack });
    }
  });

  logger.info('Tokko sync job scheduled: every 1 hour');
}
