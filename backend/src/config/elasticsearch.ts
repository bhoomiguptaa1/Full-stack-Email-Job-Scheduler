import { Client } from '@elastic/elasticsearch';
import { ENV } from './env';
import { logger } from '../utils/logger';

export const esClient = new Client({
  node: ENV.ELASTICSEARCH_NODE,
  maxRetries: 2,
  requestTimeout: 5000,
});

export interface EmailSearchDoc {
  jobId: string;
  userId: string;
  senderId?: string | null;
  senderEmail?: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  recurrence?: string;
  scheduledFor?: string;
  sentAt?: string | null;
  previewUrl?: string | null;
  failureReason?: string | null;
  createdAt?: string;
}

let esAvailable = false;

export function isElasticsearchAvailable(): boolean {
  return esAvailable;
}

export async function initElasticsearch(): Promise<boolean> {
  try {
    const exists = await esClient.indices.exists({ index: ENV.ELASTICSEARCH_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: ENV.ELASTICSEARCH_INDEX,
        mappings: {
          properties: {
            jobId: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            recurrence: { type: 'keyword' },
            scheduledFor: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
          },
        },
      });
      logger.info(`[Elasticsearch] Index "${ENV.ELASTICSEARCH_INDEX}" created.`);
    } else {
      logger.info(`[Elasticsearch] Index "${ENV.ELASTICSEARCH_INDEX}" is ready.`);
    }
    esAvailable = true;
    return true;
  } catch (error) {
    esAvailable = false;
    logger.warn('[Elasticsearch] Not reachable right now (fallback search active).', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function indexEmailJob(doc: EmailSearchDoc): Promise<void> {
  try {
    await esClient.index({
      index: ENV.ELASTICSEARCH_INDEX,
      id: doc.jobId,
      document: doc,
    });
    esAvailable = true;
  } catch (error) {
    esAvailable = false;
    logger.warn('[Elasticsearch] Index sync warning', {
      jobId: doc.jobId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function deleteEmailJobFromIndex(jobId: string): Promise<void> {
  try {
    await esClient.delete({
      index: ENV.ELASTICSEARCH_INDEX,
      id: jobId,
    });
  } catch {
    // Document may not exist yet; ignore cleanly
  }
}
