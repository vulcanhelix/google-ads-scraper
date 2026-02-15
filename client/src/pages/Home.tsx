import { useState, useEffect } from 'react';
import { DomainScrapeForm } from '../components/forms/DomainScrapeForm';
import { SuccessBanner } from '../components/results/SuccessBanner';
import { BatchResultsTable } from '../components/results/BatchResultsTable';
import { AdResultsGrid } from '../components/results/AdResultsGrid';
import { Button } from '../components/shared/Button';
import { useScrape } from '../hooks/useScrape';
import { getAdsByAdvertiser, getAdvertiserByDomain } from '../lib/api';
import type { ScrapeFormData, ScrapeResponse, AdCreative } from '../types';
import { RotateCcw, BarChart3 } from 'lucide-react';

export function Home() {
  const [showForm, setShowForm] = useState(true);
  const [scrapeData, setScrapeData] = useState<{
    scrapeResponseData: ScrapeResponse;
    domains: string[];
  } | null>(null);
  const [ads, setAds] = useState<AdCreative[]>([]);

  const { scrape, isLoading: isScraping, error: scrapeError } = useScrape();

  useEffect(() => {
    const fetchAds = async () => {
      if (scrapeData?.domains) {
        const allAds: AdCreative[] = [];
        for (const domain of scrapeData.domains) {
          const advertiser = await getAdvertiserByDomain(domain);
          if (advertiser) {
            const adsResponse = await getAdsByAdvertiser(advertiser.id);
            allAds.push(...adsResponse.ads);
          }
        }
        setAds(allAds);
      }
    };

    if (scrapeData && !isScraping) {
      fetchAds();
    }
  }, [scrapeData, isScraping]);

  const handleScrape = async (data: ScrapeFormData) => {
    try {
      const domains = Array.isArray(data.domains) ? data.domains : [data.domains];
      const scrapeOptions = {
        region: data.region,
        maxResults: data.maxResults,
      };

      const result = await scrape(
        domains[0],
        data.apiKey,
        scrapeOptions
      );

      setScrapeData({
        scrapeResponseData: result.scrapeResult,
        domains,
      });

      if (result.scrapeResult.status === 'failed') {
        return;
      }

      setShowForm(false);
    } catch (err: any) {
      console.error('Scrape failed:', err);
    }
  };

  const handleRunAgain = () => {
    setShowForm(true);
    setScrapeData(null);
    setAds([]);
  };

  const handleAdClick = () => {
    return;
  };

  if (showForm) {
    return (
      <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-xl mx-auto">
          <DomainScrapeForm onSubmit={handleScrape} isLoading={isScraping} />
          {scrapeError && (
            <div
              className="mt-5 rounded-xl p-4 fade-in"
              style={{
                background: 'rgba(248, 113, 113, 0.08)',
                border: '1px solid rgba(248, 113, 113, 0.2)',
              }}
            >
              <p className="font-medium text-sm" style={{ color: 'var(--error)' }}>Something went wrong</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{scrapeError}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-7xl mx-auto space-y-6">
        <SuccessBanner
          message={
            scrapeData?.domains.length === 1
              ? `Scraped ads for ${scrapeData.domains[0]}`
              : `Scraped ads for ${scrapeData?.domains.length} domains`
          }
          details={`Found ${ads.length} ads • Headlines extracted via API interception`}
        />

        {scrapeData?.domains.length === 1 ? (
          <AdResultsGrid
            ads={ads}
            onAdClick={handleAdClick}
            selectedDomain={scrapeData.domains[0]}
          />
        ) : (
          <>
            <BatchResultsTable
              results={
                scrapeData?.domains.map((domain) => ({
                  domain,
                  status: 'completed',
                  adsFound: ads.filter((ad) => ad.advertiser?.domain === domain).length,
                })) || []
              }
              isProcessing={false}
            />
            <AdResultsGrid
              ads={ads}
              onAdClick={handleAdClick}
            />
          </>
        )}

        <div className="flex flex-wrap gap-3 justify-center pt-8" style={{ borderTop: '1px solid var(--border-default)' }}>
          <Button variant="primary" size="md" onClick={handleRunAgain}>
            <RotateCcw size={16} />
            Scan Another Domain
          </Button>
          <Button variant="secondary" size="md" onClick={() => window.location.href = '/analytics'}>
            <BarChart3 size={16} />
            Analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
