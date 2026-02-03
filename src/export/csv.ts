import fs from 'fs';
import path from 'path';
import { ScrapeResult } from '../types';
import { logger } from '../utils/logger';

export async function exportToCsv(
  data: ScrapeResult,
  outputDir: string,
  domain: string
): Promise<string> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedDomain = domain.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${sanitizedDomain}_${timestamp}.csv`;
  const filepath = path.join(outputDir, filename);

  const headers = [
    'creative_id',
    'advertiser_id',
    'advertiser_name',
    'format',
    'platforms',
    'target_domain',
    'first_shown',
    'last_shown',
    'total_days_shown',
    'headline',
    'description',
    'details_url',
  ];

  const rows = data.ads.map((ad) => [
    ad.id,
    ad.advertiserId,
    escapeCSV(data.advertiser.name),
    ad.format,
    ad.platforms.join(';'),
    ad.targetDomain || '',
    ad.firstShown,
    ad.lastShown,
    ad.totalDaysShown.toString(),
    escapeCSV(ad.headline || ''),
    escapeCSV(ad.description || ''),
    ad.detailsUrl,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join(
    '\n'
  );

  fs.writeFileSync(filepath, csvContent);

  logger.info(`Exported CSV to: ${filepath}`);
  return filepath;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
