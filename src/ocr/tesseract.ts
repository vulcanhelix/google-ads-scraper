import { createWorker, Worker } from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number;
}

let sharedWorker: Worker | null = null;

/** Get or create a reusable Tesseract worker (avoids ~10s init per image) */
async function getWorker(): Promise<Worker> {
  if (!sharedWorker) {
    sharedWorker = await createWorker('eng');
  }
  return sharedWorker;
}

/** Terminate the shared worker when done with all OCR */
export async function terminateWorker(): Promise<void> {
  if (sharedWorker) {
    await sharedWorker.terminate();
    sharedWorker = null;
  }
}

export async function recognizeImageText(imageUrl: string): Promise<OcrResult> {
  const worker = await getWorker();
  const result = await worker.recognize(imageUrl);
  return {
    text: result.data.text || '',
    confidence: result.data.confidence ?? 0,
  };
}
