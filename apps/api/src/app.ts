import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import { env, isTest } from './config/env';
import { logger } from './lib/logger';
import { loadSession, requireAuth, requireRole } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { verifyOrigin } from './middleware/origin';
import { globalLimiter } from './middleware/rateLimit';
import { adminAffiliatesRouter, adminCommissionsRouter, adminPayoutsRouter } from './modules/admin/affiliates.routes';
import { adminOrdersRouter } from './modules/admin/orders.routes';
import { adminSettingsRouter } from './modules/admin/settings.routes';
import { adminStatsRouter } from './modules/admin/stats.routes';
import { affiliateRouter } from './modules/affiliates/affiliate.routes';
import { handleReferralClick } from './modules/affiliates/attribution';
import { adminUsersRouter } from './modules/admin/users.routes';
import { authRouter } from './modules/auth/auth.routes';
import { checkoutRouter } from './modules/checkout/checkout.routes';
import { razorpayWebhook } from './modules/checkout/webhook';
import { readerRouter } from './modules/library/reader.routes';
import { meRouter } from './modules/me/me.routes';
import { adminProductsRouter } from './modules/products/admin-products.routes';
import { publicProductsRouter } from './modules/products/public-products.routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());
  if (!isTest) app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  app.get('/api/health', (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' });
  });

  // Webhooks are mounted before the JSON parser: signature checks need the exact raw body.
  app.post('/api/v1/webhooks/razorpay', express.raw({ type: '*/*', limit: '1mb' }), razorpayWebhook);

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(verifyOrigin);
  app.use(globalLimiter);
  app.use(loadSession);

  const v1 = Router();
  v1.use('/auth', authRouter);
  v1.use('/products', publicProductsRouter);
  v1.use('/checkout', checkoutRouter);
  v1.use('/me', requireAuth, meRouter);
  v1.use('/reader', requireAuth, readerRouter);
  v1.get('/r/:code', handleReferralClick);
  v1.use('/affiliate', affiliateRouter);
  v1.use('/admin/users', requireRole('admin'), adminUsersRouter);
  v1.use('/admin/products', requireRole('admin'), adminProductsRouter);
  v1.use('/admin/orders', requireRole('admin'), adminOrdersRouter);
  v1.use('/admin/affiliates', requireRole('admin'), adminAffiliatesRouter);
  v1.use('/admin/commissions', requireRole('admin'), adminCommissionsRouter);
  v1.use('/admin/payouts', requireRole('admin'), adminPayoutsRouter);
  v1.use('/admin/settings', requireRole('admin'), adminSettingsRouter);
  v1.use('/admin', requireRole('admin'), adminStatsRouter);
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
