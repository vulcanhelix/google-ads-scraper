import { useState, useEffect } from 'react';
import { getAllAdvertisers } from '../lib/api';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import type { Advertiser } from '../types';
import { Search, ChevronRight, MapPin, Calendar, ShieldCheck, ShieldX } from 'lucide-react';

export function Advertisers() {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchAdvertisers = async () => {
      try {
        setIsLoading(true);
        const data = await getAllAdvertisers();
        setAdvertisers(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch advertisers');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAdvertisers();
  }, []);

  const filteredAdvertisers = advertisers.filter((adv) =>
    adv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    adv.domain?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen py-16 px-4" style={{ background: 'var(--bg-primary)' }}>
        <LoadingSpinner size="lg" text="Loading advertisers…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen py-16 px-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="glass-card p-8 text-center">
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--error)' }}>Error</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-7xl mx-auto space-y-6 slide-up">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Advertisers</h1>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {advertisers.length} scraped advertiser{advertisers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="btn-ghost text-sm"
          >
            ← Home
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search by name or domain…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-dark pl-10 text-sm"
          />
        </div>

        {/* Table */}
        {filteredAdvertisers.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {searchQuery ? 'No advertisers match your search' : 'No advertisers yet. Start by scanning a domain.'}
            </p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-elevated)' }}>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Name</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Domain</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Location</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Last Scraped</th>
                    <th className="px-5 py-3" style={{ color: 'var(--text-tertiary)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdvertisers.map((advertiser) => (
                    <tr
                      key={advertiser.id}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--border-default)' }}
                      onClick={() => (window.location.href = `/advertisers/${advertiser.id}`)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {advertiser.name}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm mono" style={{ color: 'var(--accent-light)' }}>
                          {advertiser.domain || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 text-xs">
                          {advertiser.verificationStatus === 'VERIFIED' ? (
                            <span className="tag-success flex items-center gap-1">
                              <ShieldCheck size={11} /> Verified
                            </span>
                          ) : (
                            <span className="tag flex items-center gap-1">
                              <ShieldX size={11} /> {advertiser.verificationStatus}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                          {advertiser.location ? (
                            <>
                              <MapPin size={12} />
                              {advertiser.location}
                            </>
                          ) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                          {advertiser.lastScrapedAt ? (
                            <>
                              <Calendar size={12} />
                              {new Date(advertiser.lastScrapedAt).toLocaleDateString()}
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)' }}>Never</span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
