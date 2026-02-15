import { useState, useEffect } from 'react';
import { getAllAdvertisers, getAdsByAdvertiser } from '../lib/api';
import type { Advertiser, AdCreative, AdFormat } from '../types';

export function Analytics() {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [ads, setAds] = useState<AdCreative[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [advertisersData] = await Promise.all([getAllAdvertisers()]);
        setAdvertisers(advertisersData);

        const allAds: AdCreative[] = [];
        for (const adv of advertisersData) {
          const adsData = await getAdsByAdvertiser(adv.id);
          allAds.push(...adsData.ads);
        }
        setAds(allAds);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
              <p className="text-slate-600">Loading analytics...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatStats = ads.reduce<Record<AdFormat, number>>(
    (acc, ad) => {
      acc[ad.format] = (acc[ad.format] || 0) + 1;
      return acc;
    },
    { text: 0, image: 0, video: 0 }
  );

  const totalAds = ads.length;

  const topAdvertisers = advertisers
    .map((adv) => ({
      ...adv,
      adCount: ads.filter((ad) => ad.advertiserId === adv.id).length,
    }))
    .sort((a, b) => b.adCount - a.adCount)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Analytics</h1>
          <p className="text-slate-600">
            Overview of your scraped ads data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="text-sm text-slate-600 mb-1">Total Advertisers</div>
            <div className="text-3xl font-bold text-slate-900">
              {advertisers.length}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="text-sm text-slate-600 mb-1">Total Ads</div>
            <div className="text-3xl font-bold text-slate-900">{totalAds}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="text-sm text-slate-600 mb-1">Avg Ads/Advertiser</div>
            <div className="text-3xl font-bold text-slate-900">
              {advertisers.length > 0
                ? (totalAds / advertisers.length).toFixed(1)
                : '0'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Format Distribution
            </h2>
            <div className="space-y-3">
              {(['text', 'image', 'video'] as AdFormat[]).map((format) => {
                const count = formatStats[format];
                const percent = totalAds > 0 ? (count / totalAds) * 100 : 0;

                return (
                  <div key={format}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 capitalize">
                        {format}
                      </span>
                      <span className="text-sm text-slate-600">
                        {count} ({percent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Top Advertisers
            </h2>
            <div className="space-y-3">
              {topAdvertisers.map((adv, index) => (
                <div
                  key={adv.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-400">
                      #{index + 1}
                    </span>
                    <div>
                      <div className="font-medium text-slate-900">
                        {adv.name}
                      </div>
                      {adv.domain && (
                        <div className="text-xs text-slate-600">
                          {adv.domain}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {adv.adCount} ads
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
