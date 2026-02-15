import { useState } from 'react';
import { Search, SlidersHorizontal, X, ArrowUpDown } from 'lucide-react';
import { AdCard } from './AdCard';
import { type AdCreative, type AdFormat } from '../../types';

interface AdResultsGridProps {
  ads: AdCreative[];
  onAdClick: (ad: AdCreative) => void;
  selectedDomain?: string;
}

export const AdResultsGrid = ({
  ads,
  onAdClick,
  selectedDomain,
}: AdResultsGridProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<AdFormat | 'all'>('all');
  const [sortBy, setSortBy] = useState<'firstShown' | 'lastShown' | 'totalDaysShown'>('lastShown');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const formats: Array<AdFormat | 'all'> = ['all', 'text', 'image', 'video'];

  const filteredAds = ads.filter((ad) => {
    const matchesSearch =
      !searchQuery ||
      ad.headline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ad.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ad.id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFormat = selectedFormat === 'all' || ad.format === selectedFormat;

    return matchesSearch && matchesFormat;
  });

  const sortedAds = [...filteredAds].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'firstShown':
        comparison = (a.firstShown || '').localeCompare(b.firstShown || '');
        break;
      case 'lastShown':
        comparison = (a.lastShown || '').localeCompare(b.lastShown || '');
        break;
      case 'totalDaysShown':
        comparison = (a.totalDaysShown || 0) - (b.totalDaysShown || 0);
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const textAdsWithContent = ads.filter((a) => a.headline).length;

  return (
    <div className="space-y-5 fade-in">
      {/* Stats bar */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <div>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{ads.length}</span>
            <span className="ml-1.5">ads found</span>
          </div>
          {textAdsWithContent > 0 && (
            <>
              <div className="w-px h-4" style={{ background: 'var(--border-default)' }} />
              <div>
                <span className="font-semibold" style={{ color: 'var(--success)' }}>{textAdsWithContent}</span>
                <span className="ml-1.5">with extracted text</span>
              </div>
            </>
          )}
          {selectedDomain && (
            <>
              <div className="w-px h-4" style={{ background: 'var(--border-default)' }} />
              <div className="mono text-xs" style={{ color: 'var(--accent-light)' }}>
                {selectedDomain}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search by headline or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-dark pl-10 pr-10 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl p-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            {formats.map((format) => (
              <button
                key={format}
                onClick={() => setSelectedFormat(format)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                style={selectedFormat === format
                  ? { background: 'var(--accent)', color: 'white' }
                  : { color: 'var(--text-tertiary)' }
                }
              >
                {format === 'all' ? 'All' : format.charAt(0).toUpperCase() + format.slice(1)}
              </button>
            ))}
          </div>

          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
              setSortBy(field);
              setSortOrder(order);
            }}
            className="input-dark text-xs py-2 px-3 w-auto cursor-pointer"
            style={{ minWidth: 'auto' }}
          >
            <option value="lastShown-desc">Latest activity</option>
            <option value="firstShown-desc">Newest first</option>
            <option value="firstShown-asc">Oldest first</option>
            <option value="totalDaysShown-desc">Longest running</option>
            <option value="totalDaysShown-asc">Shortest running</option>
          </select>
        </div>
      </div>

      {/* Results grid */}
      {sortedAds.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <SlidersHorizontal className="mx-auto mb-4" size={40} style={{ color: 'var(--text-tertiary)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>No ads match</h3>
          <p className="text-sm mb-5" style={{ color: 'var(--text-tertiary)' }}>
            Try adjusting your search or filters
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedFormat('all');
            }}
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--accent-light)' }}
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAds.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              onClick={() => onAdClick(ad)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
