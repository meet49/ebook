import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../lib/logger';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  // Some Windows setups run a local DNS forwarder that refuses the SRV lookups used by mongodb+srv:// URIs.
  if (env.DNS_SERVERS.length) dns.setServers(env.DNS_SERVERS);
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info({ db: conn.connection.name }, 'MongoDB connected');
  return conn;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
