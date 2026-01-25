import { useState, useEffect } from "react";
import { RefreshCw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface LastUpdatedProps {
  timestamp: Date | null;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  return date.toLocaleDateString();
}

export function LastUpdated({ timestamp, loading, onRefresh, className }: LastUpdatedProps) {
  const [, setTick] = useState(0);

  // Update the "time ago" display every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  if (!timestamp && !loading) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full",
        className
      )}
    >
      {loading ? (
        <>
          <RefreshCw className="w-3 h-3 animate-spin text-primary" />
          <span>Updating...</span>
        </>
      ) : timestamp ? (
        <>
          <Clock className="w-3 h-3" />
          <span>Updated {getTimeAgo(timestamp)}</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="ml-1 p-0.5 hover:bg-primary/10 rounded transition-colors"
              title="Refresh now"
            >
              <RefreshCw className="w-3 h-3 hover:text-primary" />
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}
