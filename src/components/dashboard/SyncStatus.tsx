import { useState } from "react";
import { RefreshCw, Clock, Database, ChevronDown, Zap, RotateCcw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface SyncStatusProps {
  className?: string;
  onSyncComplete?: () => void;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

export function SyncStatus({ className, onSyncComplete }: SyncStatusProps) {
  const [user] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const isAdmin = user?.role === 'admin';
  const [strategy, setStrategy] = useState<'upsert' | 'replace'>('upsert');
  
  const { 
    lastSyncTime, 
    totalProperties, 
    syncing,
    isStale,
    triggerQuickSync, 
    triggerFullSync 
  } = useSyncStatus();
  
  const [lastSyncing, setLastSyncing] = useState(syncing);

  // Only show sync controls for admin users
  if (!isAdmin) {
    return null;
  }

  // Detect when sync completes
  if (lastSyncing && !syncing) {
    onSyncComplete?.();
  }
  if (lastSyncing !== syncing) {
    setLastSyncing(syncing);
  }

  const handleQuickSync = async () => {
    await triggerQuickSync(strategy);
  };

  const handleFullSync = async () => {
    await triggerFullSync(strategy);
  };

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {/* Status Display */}
      <div className={cn(
        "flex items-center gap-2 text-xs px-3 py-1.5 rounded-full",
        isStale && !syncing 
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
          : "bg-muted/50 text-muted-foreground"
      )}>
        {syncing ? (
          <>
            <RefreshCw className="w-3 h-3 animate-spin text-primary" />
            <span>Syncing...</span>
          </>
        ) : isStale ? (
          <>
            <AlertTriangle className="w-3 h-3" />
            <span>Data outdated - syncing...</span>
          </>
        ) : lastSyncTime ? (
          <>
            <Clock className="w-3 h-3" />
            <span>Synced {getTimeAgo(lastSyncTime)}</span>
            <span className="text-muted-foreground/60">•</span>
            <Database className="w-3 h-3" />
            <span>{totalProperties.toLocaleString()}</span>
          </>
        ) : (
          <>
            <Clock className="w-3 h-3" />
            <span>No sync data</span>
          </>
        )}
      </div>

      {/* Sync Button with Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 gap-1 text-xs"
            disabled={syncing}
          >
            <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
            Sync
            <ChevronDown className="w-3 h-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Refresh data from Bridge API
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-3">
            <Label className="text-xs font-semibold mb-2 block">Sync Strategy</Label>
            <RadioGroup value={strategy} onValueChange={(v) => setStrategy(v as 'upsert' | 'replace')} className="space-y-2">
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="upsert" id="upsert" className="mt-0.5" />
                <Label htmlFor="upsert" className="text-xs cursor-pointer leading-tight">
                  <div className="font-medium">Update Existing (Upsert)</div>
                  <div className="text-muted-foreground">Keep old data, update with new info</div>
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="replace" id="replace" className="mt-0.5" />
                <Label htmlFor="replace" className="text-xs cursor-pointer leading-tight">
                  <div className="font-medium">Replace All (Delete & Insert)</div>
                  <div className="text-muted-foreground">Clear database, insert fresh data</div>
                </Label>
              </div>
            </RadioGroup>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleQuickSync} disabled={syncing}>
            <Zap className="w-4 h-4 mr-2 text-yellow-500" />
            <div className="flex flex-col">
              <span>Quick Sync</span>
              <span className="text-xs text-muted-foreground">
                Active listings only (~5 sec)
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleFullSync} disabled={syncing}>
            <RotateCcw className="w-4 h-4 mr-2 text-blue-500" />
            <div className="flex flex-col">
              <span>Full Sync</span>
              <span className="text-xs text-muted-foreground">
                All data + 5yr history (~60 sec)
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
