import { afterAll, afterEach, beforeAll, inject } from 'vitest';

// Environment must be in place before any app module (and its env validation) is imported.
process.env.NODE_ENV = 'test';
process.env.APP_URL = 'http://localhost:3000';
process.env.APP_SECRET = 'test-secret-test-secret-test-secret-0123456789';
process.env.EMAIL_TRANSPORT = 'console';
process.env.MONGODB_URI = inject('mongoUri');
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_DIR = (await import('node:path')).join((await import('node:os')).tmpdir(), `ebook-test-storage-${process.pid}`);
process.env.PAGE_RENDER_WIDTH = '600';
process.env.DISABLE_RATE_LIMITS = '1';
process.env.MIN_PAYOUT_PAISE = '10000';
// Test-only secrets: signatures in tests are computed with these, exactly as Razorpay would.
process.env.RAZORPAY_KEY_ID = 'rzp_test_unit';
process.env.RAZORPAY_KEY_SECRET = 'unit-test-key-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'unit-test-webhook-secret';

const mongoose = (await import('mongoose')).default;
await import('../src/models'); // registers every model
const { devOutbox } = await import('../src/lib/email/transport');
const { invalidatePaymentConfig } = await import('../src/lib/payments/config');

beforeAll(async () => {
  const dbName = `test_${Math.random().toString(36).slice(2, 10)}`;
  await mongoose.connect(process.env.MONGODB_URI!, { dbName });
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
});

afterEach(async () => {
  devOutbox.length = 0;
  invalidatePaymentConfig();
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await (await import('node:fs/promises')).rm(process.env.STORAGE_DIR!, { recursive: true, force: true });
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
