import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Building2,
  Upload,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Eye,
  Link2,
  AlertCircle,
  Calendar,
  Home,
  BarChart3,
} from 'lucide-react';
import permitsApi, { Permit, PermitMatch, PermitStats, PermitAnalytics } from '@/lib/api/permits';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    const date = new Date(value);
    // Check if date is valid
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NewConstruction() {
  const [activeTab, setActiveTab] = useState('overview');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMatch, setFilterMatch] = useState<string>('all');
  const [selectedPermit, setSelectedPermit] = useState<Permit | null>(null);
  const queryClient = useQueryClient();

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['permit-stats'],
    queryFn: permitsApi.stats,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['permit-analytics'],
    queryFn: permitsApi.analytics,
  });

  const { data: permitsData, isLoading: permitsLoading, refetch: refetchPermits } = useQuery({
    queryKey: ['permits', filterYear, filterStatus, filterMatch],
    queryFn: () => permitsApi.list({
      year: filterYear === 'all' ? undefined : filterYear,
      status: filterStatus === 'all' ? undefined : filterStatus,
      hasMatch: filterMatch === 'all' ? undefined : filterMatch,
      limit: 500,
    }),
  });

  // Separate query for Match Review - always gets ALL permits
  const { data: allPermitsData, isLoading: allPermitsLoading } = useQuery({
    queryKey: ['permits-all-for-review'],
    queryFn: () => permitsApi.list({ limit: 10000 }),
  });

  // Mutations
  const importMutation = useMutation({
    mutationFn: (data: { permits: Record<string, unknown>[]; sourceFile: string }) =>
      permitsApi.import(data.permits, data.sourceFile),
    onSuccess: (result) => {
      toast.success(`Imported ${result.imported} permits`);
      queryClient.invalidateQueries({ queryKey: ['permits'] });
      queryClient.invalidateQueries({ queryKey: ['permit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['permit-analytics'] });
    },
    onError: (error: Error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const matchMutation = useMutation({
    mutationFn: permitsApi.match,
    onSuccess: (result) => {
      toast.success(`Matched ${result.matched} permits (${result.unmatched} unmatched)`);
      queryClient.invalidateQueries({ queryKey: ['permits'] });
      queryClient.invalidateQueries({ queryKey: ['permit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['permit-analytics'] });
    },
    onError: (error: Error) => {
      toast.error(`Matching failed: ${error.message}`);
    },
  });

  const clearMutation = useMutation({
    mutationFn: permitsApi.clearAll,
    onSuccess: () => {
      toast.success('All permits cleared');
      queryClient.invalidateQueries({ queryKey: ['permits'] });
      queryClient.invalidateQueries({ queryKey: ['permit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['permit-analytics'] });
    },
  });

  // File upload handler
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // For CSV/JSON files, parse client-side
    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          const permits = Array.isArray(data) ? data : data.permits || [data];
          importMutation.mutate({ permits, sourceFile: file.name });
        } catch (err) {
          toast.error('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const permits = lines.slice(1).filter(l => l.trim()).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => { obj[h] = values[i] || ''; });
            return obj;
          });
          importMutation.mutate({ permits, sourceFile: file.name });
        } catch (err) {
          toast.error('Invalid CSV file');
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // For Excel files, we need to use the xlsx library
      toast.info('Processing Excel file...');
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const XLSX = await import('xlsx');
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const allPermits: Record<string, unknown>[] = [];
          
          // Process all sheets
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);
            jsonData.forEach((row: unknown) => {
              allPermits.push({ ...(row as Record<string, unknown>), __sheetName: sheetName });
            });
          }
          
          if (allPermits.length === 0) {
            toast.error('No data found in Excel file');
            return;
          }
          
          toast.info(`Found ${allPermits.length} rows across ${workbook.SheetNames.length} sheets`);
          importMutation.mutate({ permits: allPermits, sourceFile: file.name });
        } catch (err) {
          console.error('Excel parsing error:', err);
          toast.error('Failed to parse Excel file');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error('Please upload an Excel (.xlsx), JSON, or CSV file');
    }
    
    event.target.value = '';
  }, [importMutation]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            New Construction Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Wellesley building permits linked to MLS sales data
          </p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All Permits?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all permits and their MLS matches from the database.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => clearMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="outline"
            onClick={() => matchMutation.mutate()}
            disabled={matchMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${matchMutation.isPending ? 'animate-spin' : ''}`} />
            Run Matching
          </Button>
          <label>
            <Button variant="default" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Import Permits
              </span>
            </Button>
            <input
              type="file"
              accept=".json,.csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="permits" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Permits
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Match Review
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <OverviewTab stats={stats} analytics={analytics} isLoading={statsLoading || analyticsLoading} />
        </TabsContent>

        {/* Permits Tab */}
        <TabsContent value="permits" className="space-y-4">
          <PermitsTab
            permits={permitsData?.permits || []}
            isLoading={permitsLoading}
            filterYear={filterYear}
            setFilterYear={setFilterYear}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterMatch={filterMatch}
            setFilterMatch={setFilterMatch}
            onSelectPermit={setSelectedPermit}
            onRefresh={refetchPermits}
            stats={stats}
          />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsTab analytics={analytics} isLoading={analyticsLoading} />
        </TabsContent>

        {/* Match Review Tab */}
        <TabsContent value="review" className="space-y-4">
          <MatchReviewTab
            permits={allPermitsData?.permits || []}
            isLoading={allPermitsLoading}
            queryClient={queryClient}
          />
        </TabsContent>
      </Tabs>

      {/* Permit Detail Dialog */}
      {selectedPermit && (
        <PermitDetailDialog
          permit={selectedPermit}
          onClose={() => setSelectedPermit(null)}
          queryClient={queryClient}
        />
      )}
    </div>
  );
}

// ============================================================================
// OVERVIEW TAB
// ============================================================================

function OverviewTab({ stats, analytics, isLoading }: { stats?: PermitStats; analytics?: PermitAnalytics; isLoading: boolean }) {
  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const matchRate = stats ? (stats.matched / stats.total * 100) : 0;
  const highConfidenceRate = stats && stats.matched > 0 ? (stats.highConfidenceMatches / stats.matched * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Permits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All imported building permits</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Matched to MLS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats?.matched?.toLocaleString() || 0}</div>
            <Progress value={matchRate} className="mt-2" />
            <p className="text-xs text-green-600 mt-1">{matchRate.toFixed(1)}% match rate</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">High Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats?.highConfidenceMatches?.toLocaleString() || 0}</div>
            <Progress value={highConfidenceRate} className="mt-2 bg-blue-100" />
            <p className="text-xs text-blue-600 mt-1">{highConfidenceRate.toFixed(0)}% of matches (95%+ score)</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">With Sales Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats?.matchesWithSales?.toLocaleString() || 0}</div>
            <p className="text-xs text-purple-600 mt-1">Permits linked to completed sales</p>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics Row 2 - Financial */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" /> Avg Days to Sale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics?.summary.avgDaysToSale || '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">From permit to closing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" /> Sale/Cost Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{analytics?.summary.avgSaleToCostRatio || '—'}x</div>
            <p className="text-xs text-muted-foreground mt-1">Sale price vs construction cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" /> Total Construction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalEstimatedCost)}</div>
            <p className="text-xs text-muted-foreground mt-1">Estimated permit costs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Home className="h-4 w-4" /> Total Sales Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats?.totalSalesValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">MLS sales from matched permits</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Year */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Permits by Year
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.byYear.filter(y => y.year && parseInt(y.year) > 2000).slice(0, 6).map((item) => (
                <div key={item.year} className="flex items-center justify-between">
                  <span className="font-medium">{item.year || 'Unknown'}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${(item.count / (stats?.total || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-12 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Builders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Builders/Developers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics?.topBuilders.slice(0, 6).map((builder, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="font-medium truncate max-w-[200px]">{builder.builder}</span>
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">{builder.permit_count} permits</Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(builder.total_construction_cost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Match Quality Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Match Quality Summary
          </CardTitle>
          <CardDescription>
            Average match score: <span className="font-bold">{((stats?.avgMatchScore || 0) * 100).toFixed(1)}%</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">{stats?.highConfidenceMatches || 0}</div>
              <div className="text-sm text-green-700">Exact Matches (95%+)</div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">
                {(stats?.matched || 0) - (stats?.highConfidenceMatches || 0)}
              </div>
              <div className="text-sm text-yellow-700">Fuzzy Matches (75-95%)</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-2xl font-bold text-gray-600">{stats?.unmatched || 0}</div>
              <div className="text-sm text-gray-700">Unmatched</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Permit Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {stats?.byStatus.filter(s => s.record_status).map((item) => (
              <Badge key={item.record_status} variant="outline" className="text-sm py-1 px-3">
                {item.record_status || 'Unknown'}: {item.count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// PERMITS TAB
// ============================================================================

function PermitsTab({
  permits,
  isLoading,
  filterYear,
  setFilterYear,
  filterStatus,
  setFilterStatus,
  filterMatch,
  setFilterMatch,
  onSelectPermit,
  onRefresh,
  stats,
}: {
  permits: Permit[];
  isLoading: boolean;
  filterYear: string;
  setFilterYear: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filterMatch: string;
  setFilterMatch: (v: string) => void;
  onSelectPermit: (p: Permit) => void;
  onRefresh: () => void;
  stats?: PermitStats;
}) {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {stats?.byYear.map((y) => (
              <SelectItem key={y.year} value={y.year || 'unknown'}>{y.year || 'Unknown'}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {stats?.byStatus.map((s) => (
              <SelectItem key={s.record_status} value={s.record_status || 'unknown'}>{s.record_status || 'Unknown'}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterMatch} onValueChange={setFilterMatch}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Match Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Matched</SelectItem>
            <SelectItem value="false">Unmatched</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => onRefresh()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>

        <span className="text-sm text-muted-foreground ml-auto">
          Showing {permits.length} permits
        </span>
      </div>

      {/* Table */}
      <Card>
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record #</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Est. Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Match</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : permits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No permits found. Import data to get started.
                  </TableCell>
                </TableRow>
              ) : (
                permits.map((permit, idx) => (
                  <TableRow key={`permit-${permit.id}-${idx}`}>
                    <TableCell className="font-mono text-xs">{permit.record_no || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={permit.address}>
                      {permit.address || '—'}
                    </TableCell>
                    <TableCell>{permit.date_submitted ? formatDate(permit.date_submitted) : permit.year || '—'}</TableCell>
                    <TableCell>{formatCurrency(permit.estimated_cost)}</TableCell>
                    <TableCell>
                      <Badge variant={permit.record_status === 'Active' ? 'default' : 'secondary'}>
                        {permit.record_status || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {permit.match_count && permit.match_count > 0 ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {permit.best_match_score ? `${(permit.best_match_score * 100).toFixed(0)}%` : 'Yes'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Unmatched
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => onSelectPermit(permit)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </div>
  );
}

// ============================================================================
// ANALYTICS TAB
// ============================================================================

function AnalyticsTab({ analytics, isLoading }: { analytics?: PermitAnalytics; isLoading: boolean }) {
  const handleExport = async () => {
    if (!analytics) return;
    
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      
      // Summary sheet
      const summaryData = [
        ['New Construction Analytics Export'],
        ['Generated', new Date().toLocaleString()],
        [],
        ['Summary Metrics'],
        ['Avg Days to List', analytics.summary.avgDaysToList || 'N/A'],
        ['Avg Days to Sale', analytics.summary.avgDaysToSale || 'N/A'],
        ['Avg Sale/Cost Ratio', analytics.summary.avgSaleToCostRatio || 'N/A'],
        ['Total Analyzed', analytics.summary.totalAnalyzed],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
      
      // Year-over-Year sheet
      if (analytics.byYear.length > 0) {
        const yoySheet = XLSX.utils.json_to_sheet(analytics.byYear);
        XLSX.utils.book_append_sheet(wb, yoySheet, 'Year-over-Year');
      }
      
      // Top Builders sheet
      if (analytics.topBuilders.length > 0) {
        const buildersSheet = XLSX.utils.json_to_sheet(analytics.topBuilders);
        XLSX.utils.book_append_sheet(wb, buildersSheet, 'Top Builders');
      }
      
      // Details sheet
      if (analytics.details.length > 0) {
        const detailsSheet = XLSX.utils.json_to_sheet(analytics.details);
        XLSX.utils.book_append_sheet(wb, detailsSheet, 'Permit Details');
      }
      
      XLSX.writeFile(wb, `wellesley-construction-analytics-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Analytics exported to Excel');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export analytics');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleExport}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* Construction Pipeline Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Construction-to-Sale Pipeline
          </CardTitle>
          <CardDescription>Visual timeline from permit to sale</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <p className="font-medium">Permit Filed</p>
              <p className="text-2xl font-bold">{analytics?.summary.totalAnalyzed || 0}</p>
            </div>
            <div className="flex-1 flex items-center">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-green-500 flex-1 rounded" />
              <div className="text-center px-2">
                <p className="text-sm text-muted-foreground">{analytics?.summary.avgDaysToList || '—'} days</p>
              </div>
              <div className="h-1 bg-gradient-to-r from-green-500 to-purple-500 flex-1 rounded" />
            </div>
            <div className="flex-1 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-2">
                <Home className="h-8 w-8" />
              </div>
              <p className="font-medium">Listed on MLS</p>
              <p className="text-2xl font-bold">{analytics?.byYear.reduce((sum, y) => sum + y.sales, 0) || 0}</p>
            </div>
            <div className="flex-1 flex items-center">
              <div className="h-1 bg-gradient-to-r from-green-500 to-purple-500 flex-1 rounded" />
              <div className="text-center px-2">
                <p className="text-sm text-muted-foreground">{analytics?.summary.avgDaysToSale ? `${analytics.summary.avgDaysToSale} days` : '—'}</p>
              </div>
              <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500 flex-1 rounded" />
            </div>
            <div className="flex-1 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-2">
                <DollarSign className="h-8 w-8" />
              </div>
              <p className="font-medium">Sold</p>
              <p className="text-2xl font-bold">{analytics?.summary.avgSaleToCostRatio || '—'}x</p>
              <p className="text-xs text-muted-foreground">avg markup</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Days to List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.summary.avgDaysToList || '—'}</div>
            <p className="text-xs text-muted-foreground">Permit → MLS listing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Days to Sale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.summary.avgDaysToSale || '—'}</div>
            <p className="text-xs text-muted-foreground">Permit → Closing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Sale/Cost Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{analytics?.summary.avgSaleToCostRatio || '—'}x</div>
            <p className="text-xs text-muted-foreground">Average markup</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Home className="h-4 w-4" />
              Total Analyzed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.summary.totalAnalyzed || 0}</div>
            <p className="text-xs text-muted-foreground">Permits with sale data</p>
          </CardContent>
        </Card>
      </div>

      {/* By Year Table */}
      <Card>
        <CardHeader>
          <CardTitle>Year-over-Year Analysis</CardTitle>
          <CardDescription>New construction metrics by permit year</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead className="text-right">Permits</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Avg Construction Cost</TableHead>
                <TableHead className="text-right">Avg Sale Price</TableHead>
                <TableHead className="text-right">Avg Days to Sale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics?.byYear.map((row) => (
                <TableRow key={row.permit_year}>
                  <TableCell className="font-medium">{row.permit_year}</TableCell>
                  <TableCell className="text-right">{row.permits}</TableCell>
                  <TableCell className="text-right">{row.sales}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.avg_construction_cost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.avg_sale_price)}</TableCell>
                  <TableCell className="text-right">{row.avg_days_to_sale ? Math.round(row.avg_days_to_sale) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Permit → Sale Details</CardTitle>
          <CardDescription>Individual permits matched to sales</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Permit Date</TableHead>
                  <TableHead>Est. Cost</TableHead>
                  <TableHead>List Date</TableHead>
                  <TableHead>Sale Date</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead>Days to Sale</TableHead>
                  <TableHead>Ratio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics?.details.map((row, idx) => (
                  <TableRow key={`detail-${row.id}-${idx}`}>
                    <TableCell className="max-w-[150px] truncate">{row.address}</TableCell>
                    <TableCell>{row.date_submitted ? formatDate(row.date_submitted) : row.year || '—'}</TableCell>
                    <TableCell>{formatCurrency(row.estimated_cost)}</TableCell>
                    <TableCell>{formatDate(row.mls_list_date)}</TableCell>
                    <TableCell>{formatDate(row.mls_settled_date)}</TableCell>
                    <TableCell>{formatCurrency(row.mls_sale_price)}</TableCell>
                    <TableCell>{row.days_to_sale ? Math.round(row.days_to_sale) : '—'}</TableCell>
                    <TableCell>
                      {row.sale_to_cost_ratio ? (
                        <Badge variant={row.sale_to_cost_ratio > 2 ? 'default' : 'secondary'}>
                          {row.sale_to_cost_ratio.toFixed(2)}x
                        </Badge>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// MATCH REVIEW TAB
// ============================================================================

function MatchReviewTab({
  permits,
  isLoading,
  queryClient,
}: {
  permits: Permit[];
  isLoading: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  // Group permits by address to avoid showing duplicates
  const groupByAddress = (permitsList: Permit[]) => {
    const grouped = new Map<string, Permit[]>();
    permitsList.forEach(p => {
      const key = p.address_normalized || p.address || '';
      // Skip empty or whitespace-only addresses
      if (!key || key.trim() === '') return;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(p);
    });
    // Return one representative permit per address
    return Array.from(grouped.values()).map(group => group[0]);
  };

  const unmatchedPermits = groupByAddress(permits.filter(p => !p.match_count || p.match_count === 0))
    .filter(p => p.address && p.address.trim() !== ''); // Extra filter for safety
  const lowConfidencePermits = groupByAddress(permits.filter(p => p.match_count && p.match_count > 0 && p.best_match_score && p.best_match_score < 0.95));

  return (
    <div className="space-y-6">
      {/* Unmatched */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-orange-500" />
            Unmatched Permits ({unmatchedPermits.length})
          </CardTitle>
          <CardDescription>Permits without MLS matches - may need manual linking</CardDescription>
        </CardHeader>
        <CardContent>
          {unmatchedPermits.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">All permits are matched!</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Builder</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatchedPermits.slice(0, 50).map((permit, idx) => (
                    <TableRow key={`unmatched-${permit.id}-${idx}`}>
                      <TableCell>{permit.address}</TableCell>
                      <TableCell>{permit.date_submitted ? formatDate(permit.date_submitted) : permit.year || '—'}</TableCell>
                      <TableCell>{permit.applicant_name || permit.owner_name || '—'}</TableCell>
                      <TableCell>
                        <ManualMatchButton permitId={permit.id} queryClient={queryClient} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Low Confidence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Low Confidence Matches ({lowConfidencePermits.length})
          </CardTitle>
          <CardDescription>Matches with less than 95% confidence - review recommended</CardDescription>
        </CardHeader>
        <CardContent>
          {lowConfidencePermits.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No low-confidence matches to review.</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permit Address</TableHead>
                    <TableHead>Match Score</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowConfidencePermits.map((permit, idx) => (
                    <TableRow key={`lowconf-${permit.id}-${idx}`}>
                      <TableCell>{permit.address}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                          {permit.best_match_score ? `${(permit.best_match_score * 100).toFixed(0)}%` : '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ReviewMatchButton permit={permit} queryClient={queryClient} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function ManualMatchButton({ permitId, queryClient }: { permitId: number; queryClient: ReturnType<typeof useQueryClient> }) {
  const [open, setOpen] = useState(false);
  const [mlsInput, setMlsInput] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ mlsId: string; address: string; price: number }>>([]);
  const [searching, setSearching] = useState(false);

  const mutation = useMutation({
    mutationFn: (mlsId: string) => permitsApi.manualMatch(permitId, mlsId, mlsId),
    onSuccess: () => {
      toast.success('Match added successfully!');
      setOpen(false);
      setMlsInput('');
      setSearchResults([]);
      queryClient.invalidateQueries({ queryKey: ['permits'] });
      queryClient.invalidateQueries({ queryKey: ['permit-stats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSearch = async () => {
    if (!mlsInput.trim()) return;
    setSearching(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/properties?search=${encodeURIComponent(mlsInput)}&limit=10`,
        { headers: token ? { 'Authorization': `Bearer ${token}` } : {} }
      );
      const data = await response.json();
      setSearchResults(data.properties || []);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search properties');
    } finally {
      setSearching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="h-4 w-4 mr-1" />
          Link
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link Permit to MLS Property</DialogTitle>
          <DialogDescription>Search for a property by address or MLS #</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter MLS # or address..."
              value={mlsInput}
              onChange={(e) => setMlsInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching || !mlsInput.trim()}>
              {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="border rounded-lg max-h-[200px] overflow-y-auto">
              {searchResults.map((prop) => (
                <div
                  key={prop.mlsId}
                  className="p-3 border-b last:border-b-0 hover:bg-muted cursor-pointer flex justify-between items-center"
                  onClick={() => mutation.mutate(prop.mlsId)}
                >
                  <div>
                    <p className="font-medium text-sm">{prop.address}</p>
                    <p className="text-xs text-muted-foreground">MLS #{prop.mlsId}</p>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(prop.price)}</span>
                </div>
              ))}
            </div>
          )}
          
          {searchResults.length === 0 && mlsInput && !searching && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No properties found. Try a different search term.
            </p>
          )}
          
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => mutation.mutate(mlsInput)} 
              disabled={!mlsInput || mutation.isPending}
            >
              {mutation.isPending ? 'Linking...' : 'Link by MLS #'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewMatchButton({ permit, queryClient }: { permit: Permit; queryClient: ReturnType<typeof useQueryClient> }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['permit', permit.id],
    queryFn: () => permitsApi.get(permit.id),
    enabled: open,
  });

  const confirmMutation = useMutation({
    mutationFn: (matchId: number) => permitsApi.confirmMatch(permit.id, matchId),
    onSuccess: () => {
      toast.success('Match confirmed!');
      queryClient.invalidateQueries({ queryKey: ['permits'] });
      queryClient.invalidateQueries({ queryKey: ['permit', permit.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (matchId: number) => {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/permits/${permit.id}/reject-match`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ matchId }),
        }
      );
      if (!response.ok) throw new Error('Failed to reject match');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Match rejected');
      queryClient.invalidateQueries({ queryKey: ['permits'] });
      queryClient.invalidateQueries({ queryKey: ['permit', permit.id] });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-1" />
          Review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Match</DialogTitle>
          <DialogDescription>{permit.address}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Permit Details */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Permit Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Record #:</span> {data?.permit.record_no}</div>
                <div><span className="text-muted-foreground">Date:</span> {data?.permit.date_submitted ? formatDate(data?.permit.date_submitted) : data?.permit.year || '—'}</div>
                <div><span className="text-muted-foreground">Builder:</span> {data?.permit.applicant_name || data?.permit.owner_name}</div>
                <div><span className="text-muted-foreground">Est. Cost:</span> {formatCurrency(data?.permit.estimated_cost)}</div>
              </div>
            </div>

            {/* Matches */}
            <div>
              <h4 className="font-medium mb-2">Suggested MLS Matches</h4>
              {data?.matches.length === 0 ? (
                <p className="text-muted-foreground text-sm">No matches found</p>
              ) : (
                <div className="space-y-3">
                  {data?.matches.map((match) => (
                    <Card key={match.id} className={match.is_confirmed ? 'border-green-500 bg-green-50' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium">{match.mls_address}</p>
                            <p className="text-sm text-muted-foreground">MLS #{match.mls_list_no}</p>
                            <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Sale:</span>{' '}
                                <span className="font-medium">{formatCurrency(match.mls_sale_price)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Sold:</span>{' '}
                                {formatDate(match.mls_settled_date)}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Sqft:</span>{' '}
                                {match.mls_sqft?.toLocaleString() || '—'}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge 
                              variant={match.match_score >= 0.95 ? 'default' : 'secondary'}
                              className={match.match_score >= 0.95 ? 'bg-green-500' : 'bg-yellow-500 text-black'}
                            >
                              {(match.match_score * 100).toFixed(0)}% match
                            </Badge>
                            {match.is_confirmed ? (
                              <Badge className="bg-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Confirmed
                              </Badge>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => confirmMutation.mutate(match.id)}
                                  disabled={confirmMutation.isPending}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => rejectMutation.mutate(match.id)}
                                  disabled={rejectMutation.isPending}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PermitDetailDialog({
  permit,
  onClose,
  queryClient,
}: {
  permit: Permit;
  onClose: () => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['permit', permit.id],
    queryFn: () => permitsApi.get(permit.id),
  });

  const confirmMutation = useMutation({
    mutationFn: (matchId: number) => permitsApi.confirmMatch(permit.id, matchId),
    onSuccess: () => {
      toast.success('Match confirmed');
      queryClient.invalidateQueries({ queryKey: ['permits'] });
      queryClient.invalidateQueries({ queryKey: ['permit', permit.id] });
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permit Details</DialogTitle>
          <DialogDescription>{permit.address}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Permit Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Record #</span>
                <p className="font-medium">{data?.permit.record_no || '—'}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Date Submitted</span>
                <p className="font-medium">{data?.permit.date_submitted ? formatDate(data?.permit.date_submitted) : data?.permit.year || '—'}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Estimated Cost</span>
                <p className="font-medium">{formatCurrency(data?.permit.estimated_cost)}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Status</span>
                <p className="font-medium">{data?.permit.record_status || '—'}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Builder</span>
                <p className="font-medium">{data?.permit.applicant_name || data?.permit.owner_name || '—'}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Type of Work</span>
                <p className="font-medium">{data?.permit.type_of_work || '—'}</p>
              </div>
            </div>

            {/* Matches */}
            <div>
              <h3 className="font-semibold mb-3">MLS Matches</h3>
              {data?.matches.length === 0 ? (
                <p className="text-muted-foreground">No matches found</p>
              ) : (
                <div className="space-y-3">
                  {data?.matches.map((match) => (
                    <Card key={match.id} className={match.is_confirmed ? 'border-green-500' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{match.mls_address}</p>
                            <p className="text-sm text-muted-foreground">MLS #{match.mls_list_no}</p>
                            <div className="flex gap-4 mt-2 text-sm">
                              <span>Sale: {formatCurrency(match.mls_sale_price)}</span>
                              <span>Sold: {formatDate(match.mls_settled_date)}</span>
                              <span>{match.mls_sqft} sqft</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={match.match_type === 'exact' ? 'default' : 'secondary'}>
                              {(match.match_score * 100).toFixed(0)}%
                            </Badge>
                            {match.is_confirmed ? (
                              <Badge className="bg-green-500">Confirmed</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => confirmMutation.mutate(match.id)}
                              >
                                Confirm
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
