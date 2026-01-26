import { useState, useEffect, useCallback, useRef } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const AUTO_SYNC_THRESHOLD_HOURS = 6;

interface SyncLog {
  id: number;
  status: string;
  started_at: string;
  completed_at: string;
  properties_synced: number;
  error_message?: string;
}

interface SyncStatus {
  lastSync: SyncLog | null;
  totalProperties: number;
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSyncTriggered = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/sync/status`);
      if (!response.ok) throw new Error("Failed to fetch sync status");
      const data = await response.json();
      setStatus(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerQuickSync = useCallback(async (strategy: 'upsert' | 'replace' = 'upsert') => {
    setSyncing(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/sync/quick`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      });
      if (!response.ok) throw new Error("Failed to start sync");
      
      // Poll for completion
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch(`${BACKEND_URL}/api/sync/status`);
        const statusData = await statusResponse.json();
        
        // Check if a new sync completed (compare timestamps)
        if (status?.lastSync?.completed_at !== statusData.lastSync?.completed_at) {
          setStatus(statusData);
          setSyncing(false);
          clearInterval(pollInterval);
        }
      }, 2000);

      // Timeout after 60 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
        setSyncing(false);
        fetchStatus(); // Final refresh
      }, 60000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync");
      setSyncing(false);
    }
  }, [status, fetchStatus]);

  const triggerFullSync = useCallback(async (strategy: 'upsert' | 'replace' = 'upsert') => {
    setSyncing(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/sync`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      });
      if (!response.ok) throw new Error("Failed to start sync");
      
      // Poll for completion (longer timeout for full sync)
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch(`${BACKEND_URL}/api/sync/status`);
        const statusData = await statusResponse.json();
        
        if (status?.lastSync?.completed_at !== statusData.lastSync?.completed_at) {
          setStatus(statusData);
          setSyncing(false);
          clearInterval(pollInterval);
        }
      }, 5000);

      // Timeout after 5 minutes for full sync
      setTimeout(() => {
        clearInterval(pollInterval);
        setSyncing(false);
        fetchStatus();
      }, 300000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync");
      setSyncing(false);
    }
  }, [status, fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-sync if data is older than threshold
  useEffect(() => {
    if (loading || syncing || autoSyncTriggered.current) return;
    
    const lastSyncTime = status?.lastSync?.completed_at 
      ? new Date(status.lastSync.completed_at) 
      : null;
    
    if (!lastSyncTime) {
      // No sync history - trigger sync
      console.log('No sync history found - triggering auto-sync');
      autoSyncTriggered.current = true;
      triggerQuickSync();
      return;
    }

    const hoursSinceSync = (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceSync > AUTO_SYNC_THRESHOLD_HOURS) {
      console.log(`Data is ${hoursSinceSync.toFixed(1)}h old - triggering auto-sync`);
      autoSyncTriggered.current = true;
      triggerQuickSync();
    }
  }, [loading, syncing, status, triggerQuickSync]);

  // Calculate if data is stale
  const isStale = (() => {
    if (!status?.lastSync?.completed_at) return true;
    const hoursSinceSync = (Date.now() - new Date(status.lastSync.completed_at).getTime()) / (1000 * 60 * 60);
    return hoursSinceSync > AUTO_SYNC_THRESHOLD_HOURS;
  })();

  return {
    lastSyncTime: status?.lastSync?.completed_at ? new Date(status.lastSync.completed_at) : null,
    totalProperties: status?.totalProperties || 0,
    propertiesSynced: status?.lastSync?.properties_synced || 0,
    loading,
    syncing,
    error,
    isStale,
    triggerQuickSync,
    triggerFullSync,
    refresh: fetchStatus,
  };
}
