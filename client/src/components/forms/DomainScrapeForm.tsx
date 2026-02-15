import { useState } from 'react';
import { APIKeyInput } from './APIKeyInput';
import { SingleDomainInput } from './SingleDomainInput';
import { BatchDomainInput } from './BatchDomainInput';
import { ScrapeOptionsForm } from './ScrapeOptionsForm';
import { type ScrapeFormData, type ScrapeOptions } from '../../types';
import { Loader2, Search, Layers } from 'lucide-react';

interface DomainScrapeFormProps {
  onSubmit: (data: ScrapeFormData) => void;
  isLoading: boolean;
}

export const DomainScrapeForm = ({ onSubmit, isLoading }: DomainScrapeFormProps) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [apiKey, setApiKey] = useState('');
  const [singleDomain, setSingleDomain] = useState('');
  const [batchDomains, setBatchDomains] = useState('');
  const [scrapeOptions, setScrapeOptions] = useState<ScrapeOptions>({
    region: 'US',
    maxResults: 20,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!apiKey.trim()) {
      newErrors.apiKey = 'API key is required';
    }

    if (mode === 'single') {
      if (!singleDomain.trim()) {
        newErrors.domain = 'Domain is required';
      } else if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/.test(singleDomain.trim())) {
        newErrors.domain = 'Please enter a valid domain (e.g., example.com)';
      }
    } else {
      const domains = batchDomains
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean);

      if (domains.length === 0) {
        newErrors.domains = 'At least one domain is required';
      }

      const invalidDomains = domains.filter(
        (d) => !/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/.test(d)
      );

      if (invalidDomains.length > 0) {
        newErrors.domains = `Invalid domain(s): ${invalidDomains.join(', ')}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data: ScrapeFormData = {
      apiKey: apiKey.trim(),
      mode,
      domains:
        mode === 'single'
          ? singleDomain.trim()
          : batchDomains.split('\n').map((d) => d.trim()).filter(Boolean),
      region: scrapeOptions.region,
      maxResults: scrapeOptions.maxResults,
      runOCR: false,
    };

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-8 slide-up">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ background: 'var(--accent-glow)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <Search size={22} style={{ color: 'var(--accent-light)' }} />
        </div>
        <h1 className="text-2xl font-bold text-gradient-accent mb-1.5">Ad Intelligence</h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Scrape competitor ads from Google Ads Transparency Center
        </p>
      </div>

      <APIKeyInput value={apiKey} onChange={setApiKey} error={errors.apiKey} />

      {/* Mode Tabs */}
      <div className="mb-6">
        <div className="flex items-center rounded-xl p-1 mb-4" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)' }}>
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
              ${mode === 'single'
                ? 'text-white shadow-lg'
                : 'hover:text-white'
              }`}
            style={mode === 'single'
              ? { background: 'var(--accent)', color: 'white' }
              : { color: 'var(--text-tertiary)' }
            }
          >
            <Search size={14} />
            Single
          </button>
          <button
            type="button"
            onClick={() => setMode('batch')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
              ${mode === 'batch'
                ? 'text-white shadow-lg'
                : 'hover:text-white'
              }`}
            style={mode === 'batch'
              ? { background: 'var(--accent)', color: 'white' }
              : { color: 'var(--text-tertiary)' }
            }
          >
            <Layers size={14} />
            Batch
          </button>
        </div>

        {mode === 'single' ? (
          <SingleDomainInput
            value={singleDomain}
            onChange={setSingleDomain}
            error={errors.domain}
          />
        ) : (
          <BatchDomainInput
            value={batchDomains}
            onChange={setBatchDomains}
            error={errors.domains}
          />
        )}
      </div>

      {/* Options */}
      <div className="pt-6 mb-8" style={{ borderTop: '1px solid var(--border-default)' }}>
        <h3 className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Settings
        </h3>
        <ScrapeOptionsForm
          scrapeOptions={scrapeOptions}
          onScrapeOptionsChange={setScrapeOptions}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="btn-accent text-[15px]"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" size={18} />
            Scanning ads…
          </>
        ) : mode === 'single' ? (
          'Scan Ads'
        ) : (
          'Scan All Domains'
        )}
      </button>
    </form>
  );
};
