import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getAdvertiserById, getAdsByAdvertiser } from '../lib/api';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { AdResultsGrid } from '../components/results/AdResultsGrid';
import { Badge } from '../components/shared/Badge';
import type { Advertiser, AdCreative } from '../types';
import { ArrowLeft, Globe, MapPin, Calendar, ShieldCheck } from 'lucide-react';

export function AdvertiserDetail() {
  const { id } = useParams<{ id: string }>();
  const [advertiser, setAdvertiser] = useState<Advertiser | null>(null);
  const [ads, setAds] = useState<AdCreative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        const [advertiserData, adsData] = await Promise.all([
          getAdvertiserById(id),
          getAdsByAdvertiser(id),
        ]);
        setAdvertiser(advertiserData);
        setAds(adsData.ads);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch advertiser');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen py-16 px-4" style={{ background: 'var(--bg-primary)' }}>
        <LoadingSpinner size="lg" text="Loading advertiser…" />
      </div>
    );
  }

  if (error || !advertiser) {
    return (
      <div className="min-h-screen py-16 px-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="glass-card p-8 text-center">
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--error)' }}>
              {error || 'Advertiser not found'}
            </h2>
            <button
              onClick={() => window.history.back()}
              className="btn-ghost text-sm mt-4 inline-flex"
            >
              ← Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-7xl mx-auto space-y-6 slide-up">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: 'var(--accent-light)' }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* Advertiser header card */}
        <div className="glass-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {advertiser.name}
              </h1>
              {advertiser.domain && (
                <p className="flex items-center gap-1.5 mono text-sm" style={{ color: 'var(--accent-light)' }}>
                  <Globe size={13} /> {advertiser.domain}
                </p>
              )}
            </div>
            {advertiser.verificationStatus === 'VERIFIED' ? (
              <Badge variant="success">
                <span className="flex items-center gap-1"><ShieldCheck size={11} /> Verified</span>
              </Badge>
            ) : (
              <Badge>{advertiser.verificationStatus}</Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {advertiser.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} /> {advertiser.location}
              </span>
            )}
            {advertiser.lastScrapedAt && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13} /> Last scraped {new Date(advertiser.lastScrapedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Ads section */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Ads
            <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-tertiary)' }}>
              ({ads.length})
            </span>
          </h2>

          {ads.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No ads found for this advertiser.</p>
            </div>
          ) : (
            <AdResultsGrid
              ads={ads}
              onAdClick={(ad) => window.location.href = `/ads/${ad.id}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
