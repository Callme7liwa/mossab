import { useState, useEffect, useCallback } from "react";
import type { SimpleProperty, MarketStats, FetchPropertiesOptions } from "@/types/property";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

interface UsePropertiesOptions extends FetchPropertiesOptions {
  skipCache?: boolean;
}

interface UsePropertiesResult {
  properties: SimpleProperty[];
  stats: MarketStats;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  lastUpdated: Date | null;
  isCached: boolean;
}

export function useProperties(options: UsePropertiesOptions = {}): UsePropertiesResult {
  const { skipCache = false, ...fetchOptions } = options;
  const [properties, setProperties] = useState<SimpleProperty[]>([]);
  const [stats, setStats] = useState<MarketStats>({
    medianPrice: 0,
    avgPricePerSqft: 0,
    totalInventory: 0,
    avgDaysOnMarket: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isCached, setIsCached] = useState(false);

  const loadProperties = useCallback(
    async (showLoading = true, forceRefresh = false) => {
      if (showLoading) setLoading(true);
      setError(null);

      try {
        // Build query parameters for backend
        const params = new URLSearchParams();
        
        // Use direct status parameter if provided, otherwise parse from filter
        if ((fetchOptions as any).status) {
          params.append('status', (fetchOptions as any).status);
        } else if (fetchOptions.filter) {
          // Parse filter to extract status (legacy support)
          const statusMatch = fetchOptions.filter.match(/StandardStatus eq '([^']+)'/);
          if (statusMatch) {
            params.append('status', statusMatch[1]);
          }
        }
        
        if ((fetchOptions as any).propertyType) {
          params.append('propertyType', (fetchOptions as any).propertyType);
        }

        if ((fetchOptions as any).town) {
          params.append('city', (fetchOptions as any).town);
        }

        if ((fetchOptions as any).timeframe) {
          params.append('timeframe', (fetchOptions as any).timeframe);
        }

        if (fetchOptions.top) {
          params.append('limit', fetchOptions.top.toString());
        }

        // Fetch from backend
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${BACKEND_URL}/api/properties?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const properties = data.properties || [];

        // Calculate stats with proper rounding
        const validProperties = properties.filter((p: any) => p.price > 0);
        // Calculate median for all metrics
        const sortedPrices = validProperties.map((p: any) => p.price).sort((a, b) => a - b);
        const sortedPricePerSqft = validProperties.map((p: any) => p.price / (p.sqft || 1)).filter(v => !isNaN(v) && isFinite(v)).sort((a, b) => a - b);
        const sortedDOM = validProperties.map((p: any) => p.dom || 0).filter(d => d >= 0).sort((a, b) => a - b);
        
        const getMedian = (arr: number[]) => {
          if (arr.length === 0) return 0;
          const mid = Math.floor(arr.length / 2);
          return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
        };

        const stats: MarketStats = {
          totalInventory: validProperties.length,
          medianPrice: Math.round(getMedian(sortedPrices)),
          avgPricePerSqft: Math.round(getMedian(sortedPricePerSqft)),
          avgDaysOnMarket: Math.round(getMedian(sortedDOM)),
        };

        setProperties(properties);
        setStats(stats);
        setLastUpdated(new Date());
        setIsCached(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch properties");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [JSON.stringify(fetchOptions)]
  );

  // Initial load
  useEffect(() => {
    loadProperties(true, false);
  }, [refetchTrigger, loadProperties]);

  const refetch = () => setRefetchTrigger((prev) => prev + 1);

  return { properties, stats, loading, error, refetch, lastUpdated, isCached };
}
