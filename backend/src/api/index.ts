// Vercel serverless entry point for the Express API
// This file is what Vercel actually runs — it imports the configured app,
// connects to DB/ES once (kept warm across invocations), and exports the handler.

import { connectDB } from '../config/db';
import { initElasticsearch } from '../config/elasticsearch';
import { logger } from '../utils/logger';
import { app } from '../index';

let initialized = false;

async function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  try {
    await connectDB();
    await initElasticsearch();
    logger.info('[Vercel] Server initialized (cold start)');
  } catch (err) {
    initialized = false; // allow retry on next invocation
    logger.error('[Vercel] Init failed', { error: String(err) });
    throw err;
  }
}

// Vercel expects a default export of a request handler
export default async function handler(req: any, res: any) {
  await ensureInitialized();
  return app(req, res);
}
