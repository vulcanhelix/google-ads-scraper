import { type ScrapeOptions } from '../../types';

interface ScrapeOptionsFormProps {
  scrapeOptions: ScrapeOptions;
  onScrapeOptionsChange: (options: ScrapeOptions) => void;
}

export const ScrapeOptionsForm = ({
  scrapeOptions,
  onScrapeOptionsChange,
}: ScrapeOptionsFormProps) => {
  const regions = [
    { code: '', name: 'All Regions' },
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'CA', name: 'Canada' },
    { code: 'AU', name: 'Australia' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
          Region
        </label>
        <select
          value={scrapeOptions.region || ''}
          onChange={(e) =>
            onScrapeOptionsChange({
              ...scrapeOptions,
              region: e.target.value || undefined,
            })
          }
          className="input-dark cursor-pointer"
        >
          {regions.map((region) => (
            <option key={region.code} value={region.code}>
              {region.name}{region.code ? ` (${region.code})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
          Max Ads
          <span className="ml-2 text-sm normal-case tracking-normal" style={{ color: 'var(--accent-light)' }}>
            {scrapeOptions.maxResults}
          </span>
        </label>
        <input
          type="range"
          min="5"
          max="50"
          step="5"
          value={scrapeOptions.maxResults}
          onChange={(e) =>
            onScrapeOptionsChange({
              ...scrapeOptions,
              maxResults: parseInt(e.target.value),
            })
          }
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-3"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((scrapeOptions.maxResults - 5) / 45) * 100}%, var(--bg-elevated) ${((scrapeOptions.maxResults - 5) / 45) * 100}%, var(--bg-elevated) 100%)`,
          }}
        />
        <div className="flex justify-between text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
          <span>5</span>
          <span>50</span>
        </div>
      </div>
    </div>
  );
};
