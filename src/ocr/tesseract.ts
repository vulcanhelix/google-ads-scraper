import { createWorker, Worker } from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number;
}

const workerPool: Worker[] = [];
const POOL_SIZE = 3;

/** Initialize a pool of Tesseract workers for parallel OCR */
async function ensurePool(): Promise<void> {
  if (workerPool.length >= POOL_SIZE) return;
  const needed = POOL_SIZE - workerPool.length;
  const newWorkers = await Promise.all(
    Array.from({ length: needed }, () => createWorker('eng'))
  );
  workerPool.push(...newWorkers);
}

/** Terminate all workers when done */
export async function terminateWorker(): Promise<void> {
  await Promise.all(workerPool.map(w => w.terminate()));
  workerPool.length = 0;
}

let nextWorkerIndex = 0;

export async function recognizeImageText(imageUrl: string): Promise<OcrResult> {
  await ensurePool();
  const worker = workerPool[nextWorkerIndex % workerPool.length];
  nextWorkerIndex++;
  const result = await worker.recognize(imageUrl);
  return {
    text: result.data.text || '',
    confidence: result.data.confidence ?? 0,
  };
}
