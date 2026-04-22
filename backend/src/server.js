import app from './app.js';
import env from './config/env.js';
import logger from './config/logger.js';
import { testConnection } from './config/db.js';
import { startTokkoSyncJob } from './jobs/tokkoSyncJob.js';

async function startServer() {
  try {
    await testConnection();
    startTokkoSyncJob();

    app.listen(env.port, () => {
      logger.info(`Server running on port ${env.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { message: error.message, stack: error.stack });
    process.exit(1);
  }
}

startServer();
