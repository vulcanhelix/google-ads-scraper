import { useState, useEffect } from 'react';
import { getAllAdvertisers, getAdsByAdvertiser } from '../lib/api';
import type { Advertiser, AdCreative } from '../types';

export function Compare() {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ads, setAds] = useState<Record<string, AdCreative[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAdvertisers = async () => {
      try {
        const data = await getAllAdvertisers();
        setAdvertisers(data);
      } catch (err) {
        console.error('Failed to fetch advertisers:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdvertisers();
  }, []);

  useEffect(() => {
    const fetchAds = async () => {
      if (selectedIds.length === 0) {
        setAds({});
        return;
      }

      const adsData: Record<string, AdCreative[]> = {};
      for (const id of selectedIds) {
        const response = await getAdsByAdvertiser(id);
        adsData[id] = response.ads;
      }
      setAds(adsData);
    };

    fetchAds();
  }, [selectedIds]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
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

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Compare Advertisers</h1>
          <p className="text-slate-600">
            Select up to 3 advertisers to compare their ads side by side
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Select Advertisers ({selectedIds.length}/3)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {advertisers.map((adv) => (
              <button
                key={adv.id}
                onClick={() => toggleSelection(adv.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all
                  ${selectedIds.includes(adv.id)
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                  }`}
              >
                <div className="font-medium text-slate-900">{adv.name}</div>
                {adv.domain && (
                  <div className="text-sm text-slate-600">{adv.domain}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-x divide-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {selectedIds.map((id) => {
                const advertiser = advertisers.find((a) => a.id === id);
                const advertiserAds = ads[id] || [];

                return (
                  <div key={id} className="p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {advertiser?.name}
                    </h3>
                    <p className="text-sm text-slate-600 mb-4">
                      {advertiserAds.length} ads
                    </p>

                    <div className="space-y-3">
                      {advertiserAds.slice(0, 5).map((ad) => (
                        <div
                          key={ad.id}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-100"
                        >
                          <p className="text-sm font-medium text-slate-900 line-clamp-1">
                            {ad.headline || 'No headline'}
                          </p>
                          {ad.description && (
                            <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                              {ad.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full capitalize">
                              {ad.format}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {advertiserAds.length > 5 && (
                      <p className="text-sm text-slate-500 mt-3">
                        +{advertiserAds.length - 5} more ads
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
