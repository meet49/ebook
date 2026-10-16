/**
 * Creates (or promotes) the first admin account from SEED_ADMIN_* env vars.
 * Usage: npm run seed:admin
 */
import { emailSchema, nameSchema, passwordSchema } from '@ebook/shared';
import { env } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../db/connect';
import { hashPassword } from '../lib/crypto';
import { User } from '../models/User';

async function main() {
  const email = emailSchema.parse(process.env.SEED_ADMIN_EMAIL);
  const password = passwordSchema.parse(process.env.SEED_ADMIN_PASSWORD);
  const name = nameSchema.parse(process.env.SEED_ADMIN_NAME ?? 'Administrator');

  await connectDatabase(env.MONGODB_URI);
  await User.syncIndexes();

  const existing = await User.findOne({ email });
  if (existing) {
    await User.updateOne(
      { _id: existing._id },
      { $addToSet: { roles: 'admin' }, $set: { passwordHash: await hashPassword(password), status: 'active' } },
    );
    console.log(`Updated existing user ${email} with admin role.`);
  } else {
    await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      roles: ['admin'],
      emailVerifiedAt: new Date(),
    });
    console.log(`Created admin ${email}.`);
  }
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
