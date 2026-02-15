import axios from 'axios';
import type {
  Advertiser,
  AdCreative,
  AdvertiserSummary,
  AdsResponse,
  AdIntelligence,
  ScrapeResponse,
  ScrapeOptions,
  BatchScrapeResult,
  BatchProgress,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function scrapeDomain(
  domain: string,
  apiKey: string,
  options: ScrapeOptions
): Promise<ScrapeResponse> {
  try {
    const response = await api.post('/scrape', {
      domain,
      ...options,
    }, {
      headers: {
        'x-api-key': apiKey,
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw new Error('Failed to scrape domain');
  }
}

export async function batchScrapeDomains(
  domains: string[],
  apiKey: string,
  options: ScrapeOptions,
  onProgress: (progress: BatchProgress) => void
): Promise<BatchScrapeResult> {
  const results: any[] = [];
  let totalAds = 0;
  let completedDomains = 0;
  let failedDomains = 0;

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i].trim();
    if (!domain) continue;

    try {
      onProgress({
        currentIndex: i,
        total: domains.length,
        currentDomain: domain,
        status: 'scraping',
      });

      await scrapeDomain(domain, apiKey, options);

      const advertiser = await getAdvertiserByDomain(domain);
      const ads = advertiser ? await getAdsByAdvertiser(advertiser.id) : { ads: [] };

      results.push({
        domain,
        status: 'completed',
        adsFound: ads.ads.length,
        advertiser,
        ads: ads.ads,
      });

      totalAds += ads.ads.length;
      completedDomains++;

      onProgress({
        currentIndex: i + 1,
        total: domains.length,
        currentDomain: domain,
        status: 'completed',
      });
    } catch (error: any) {
      results.push({
        domain,
        status: 'failed',
        error: error.message || 'Unknown error',
      });
      failedDomains++;

      onProgress({
        currentIndex: i + 1,
        total: domains.length,
        currentDomain: domain,
        status: 'failed',
      });
    }
  }

  return {
    results,
    totalAds,
    completedDomains,
    failedDomains,
  };
}

export async function getAdIntelligence(advertiserId: string): Promise<AdIntelligence> {
  try {
    const response = await api.get(`/ads/advertiser/${advertiserId}/intelligence`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw new Error('Failed to fetch ad intelligence');
  }
}

export async function getAdsWithCopy(advertiserId: string): Promise<AdsResponse> {
  try {
    const response = await api.get(`/ads/advertiser/${advertiserId}/with-copy`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw new Error('Failed to fetch ads with copy');
  }
}

export async function getAdsByAdvertiser(advertiserId: string): Promise<AdsResponse> {
  try {
    const response = await api.get(`/ads/advertiser/${advertiserId}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw new Error('Failed to fetch ads');
  }
}

export async function getAllAdvertisers(): Promise<Advertiser[]> {
  try {
    const response = await api.get('/advertisers');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw new Error('Failed to fetch advertisers');
  }
}

export async function getAdvertiserById(id: string): Promise<Advertiser> {
  try {
    const response = await api.get(`/advertisers/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw new Error('Failed to fetch advertiser');
  }
}

export async function getAdvertiserByDomain(domain: string): Promise<Advertiser | null> {
  try {
    const response = await api.get(`/advertisers/domain/${domain}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch advertiser');
  }
}

export async function getAdvertiserSummary(id: string): Promise<AdvertiserSummary> {
  try {
    const response = await api.get(`/advertisers/${id}/summary`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw new Error('Failed to fetch advertiser summary');
  }
}

export async function getAdById(id: string): Promise<AdCreative> {
  try {
    const response = await api.get(`/ads/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw error.response.data;
    }
    throw new Error('Failed to fetch ad');
  }
}



export async function checkHealth(): Promise<{ status: string; database: string }> {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    throw new Error('Health check failed');
  }
}
