import { useState, useEffect, useCallback } from "react";
import type { SimpleProperty, MarketStats, FetchPropertiesOptions } from "@/types/property";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

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
        
        if (fetchOptions.filter) {
          // Parse filter to extract status
          const statusMatch = fetchOptions.filter.match(/StandardStatus eq '([^']+)'/);
          if (statusMatch) {
            params.append('status', statusMatch[1]);
          }
        }
        
        if (fetchOptions.top) {
          params.append('limit', fetchOptions.top.toString());
        }

        // Fetch from backend
        const response = await fetch(`${BACKEND_URL}/api/properties?${params}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const properties = data.properties || [];

        // Calculate stats with proper rounding
        const validProperties = properties.filter((p: any) => p.price > 0);
        const stats: MarketStats = {
          totalInventory: validProperties.length,
          medianPrice: validProperties.length > 0
            ? Math.round(validProperties.sort((a: any, b: any) => a.price - b.price)[Math.floor(validProperties.length / 2)]?.price || 0)
            : 0,
          avgPricePerSqft: validProperties.length > 0
            ? Math.round(validProperties.reduce((sum: number, p: any) => sum + (p.price / (p.sqft || 1)), 0) / validProperties.length)
            : 0,
          avgDaysOnMarket: validProperties.length > 0
            ? Math.round(validProperties.reduce((sum: number, p: any) => sum + (p.dom || 0), 0) / validProperties.length)
            : 0,
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
