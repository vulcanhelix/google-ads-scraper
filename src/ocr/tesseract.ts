import { createWorker } from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number;
}

export async function recognizeImageText(imageUrl: string): Promise<OcrResult> {
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(imageUrl);
    return {
      text: result.data.text || '',
      confidence: result.data.confidence ?? 0,
    };
  } finally {
    await worker.terminate();
  }
}
