import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getAdById } from '../lib/api';
import type { AdCreative, AdPlatform } from '../types';

export function AdDetail() {
  const { id } = useParams<{ id: string }>();
  const [ad, setAd] = useState<AdCreative | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAd = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        const adData = await getAdById(id);
        setAd(adData);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch ad');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAd();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
              <p className="text-slate-600">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold text-red-700 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-slate-600">Ad not found</p>
          </div>
        </div>
      </div>
    );
  }

  const platformLabels: Partial<Record<string, string>> = {
    google_search: 'Google Search',
    youtube: 'YouTube',
    google_maps: 'Google Maps',
    google_play: 'Google Play',
    google_shopping: 'Google Shopping',
    display_network: 'Display Network',
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => window.history.back()}
          className="text-indigo-600 hover:text-indigo-700 font-medium"
        >
          ← Back
        </button>

        {ad.previewUrl && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <img
              src={ad.previewUrl}
              alt="Ad preview"
              className="w-full rounded-lg border border-slate-200"
            />
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-700 capitalize mb-2">
                {ad.format}
              </span>
              <h1 className="text-2xl font-bold text-slate-900">
                {ad.headline || 'No headline'}
              </h1>
            </div>
          </div>

          {ad.description && (
            <p className="text-lg text-slate-600 mb-6">{ad.description}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Format</p>
              <p className="font-medium text-slate-900 capitalize">{ad.format}</p>
            </div>
            <div>
              <p className="text-slate-500">Total Days Shown</p>
              <p className="font-medium text-slate-900">{ad.totalDaysShown}</p>
            </div>
            <div>
              <p className="text-slate-500">First Shown</p>
              <p className="font-medium text-slate-900">{ad.firstShown || '-'}</p>
            </div>
            <div>
              <p className="text-slate-500">Last Shown</p>
              <p className="font-medium text-slate-900">{ad.lastShown || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500">Target Domain</p>
              <p className="font-medium text-slate-900">{ad.targetDomain || '-'}</p>
            </div>
          </div>

          {ad.platforms.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-sm text-slate-500 mb-2">Platforms</p>
              <div className="flex flex-wrap gap-2">
                {ad.platforms.map((platform: AdPlatform) => (
                  <span
                    key={platform}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700"
                  >
                    {platformLabels[platform] || platform}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {(ad.headlineConfidence !== undefined || ad.descriptionConfidence !== undefined) && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">OCR Confidence</h2>
            <div className="space-y-2">
              {ad.headlineConfidence !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Headline</span>
                  <span className="text-sm font-medium text-slate-900">
                    {(ad.headlineConfidence * 100).toFixed(1)}%
                  </span>
                </div>
              )}
              {ad.descriptionConfidence !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Description</span>
                  <span className="text-sm font-medium text-slate-900">
                    {(ad.descriptionConfidence * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {ad.detailsUrl && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Source</h2>
            <a
              href={ad.detailsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              View on Google Ads Transparency Center →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
