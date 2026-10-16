import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './db/connect';
import { logger } from './lib/logger';
import { promotePayableCommissions } from './modules/commissions/ledger';
import { resumePendingProcessing } from './modules/products/processing';

async function main() {
  await connectDatabase(env.MONGODB_URI);
  const server = createApp().listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
  });
  await resumePendingProcessing();
  // Approved commissions become payable when their refund hold ends (also checked on every ledger read).
  setInterval(() => void promotePayableCommissions().catch((err) => logger.error({ err }, 'Payable sweep failed')), 60 * 60_000).unref();

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start API');
  process.exit(1);
});
