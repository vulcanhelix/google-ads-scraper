import { runOcr } from '../commands/ocr';
import { logger } from '../utils/logger';

type OcrJob = {
  id: string;
  domain: string;
  limit?: number;
  force?: boolean;
  status: 'queued' | 'running' | 'completed' | 'failed';
  processed?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
};

const queue: OcrJob[] = [];
let processing = false;

function createJobId(): string {
  return `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function enqueueOcrJob(domain: string, limit?: number, force?: boolean) {
  const cappedLimit = limit && limit > 0 ? Math.min(limit, 10) : undefined;
  const job: OcrJob = {
    id: createJobId(),
    domain,
    limit: cappedLimit,
    force,
    status: 'queued',
  };

  queue.push(job);
  void processQueue();
  return job;
}

export function getOcrJob(jobId: string): OcrJob | undefined {
  return queue.find((job) => job.id === jobId);
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.some((job) => job.status === 'queued')) {
    const nextJob = queue.find((job) => job.status === 'queued');
    if (!nextJob) break;

    nextJob.status = 'running';
    nextJob.startedAt = new Date();

    try {
      logger.info(`OCR job ${nextJob.id} started for ${nextJob.domain}`);
      const processed = await runOcr(nextJob.domain, {
        limit: nextJob.limit,
        force: nextJob.force,
      });
      nextJob.processed = processed;
      nextJob.status = 'completed';
    } catch (error) {
      nextJob.status = 'failed';
      nextJob.error = error instanceof Error ? error.message : String(error);
      logger.warn(`OCR job ${nextJob.id} failed: ${nextJob.error}`);
    } finally {
      nextJob.completedAt = new Date();
    }
  }

  processing = false;
}
