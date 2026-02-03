import fs from 'fs';
import path from 'path';
import { ScrapeResult } from '../types';
import { logger } from '../utils/logger';

export async function exportToJson(
  data: ScrapeResult,
  outputDir: string,
  domain: string
): Promise<string> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedDomain = domain.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${sanitizedDomain}_${timestamp}.json`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

  logger.info(`Exported JSON to: ${filepath}`);
  return filepath;
}
