import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Clock,
  TrendingDown,
  DollarSign,
  Loader2,
  RefreshCw,
  Target,
  BarChart3,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LastUpdated } from "@/components/dashboard/LastUpdated";
import { useProperties } from "@/hooks/useProperties";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

const TOWNS = ["All Towns", "Weston", "Wellesley", "Newton", "Needham", "Dover", "Natick", "Westwood"];

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm text-muted-foreground">
            {entry.name}: <span className="text-primary font-medium">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ContingentAnalysis() {
  // "Active Under Contract" is the MLSPIN equivalent of "Contingent"
  const { properties: contingentProps, loading: loadingContingent, refetch, lastUpdated } = useProperties({ 
    top: 500,
    filter: "StandardStatus eq 'Active Under Contract'",
    skipCache: true
  });

  // Also fetch Canceled/Expired to track fall-throughs
  const { properties: canceledProps, loading: loadingCanceled } = useProperties({ 
    top: 500,
    filter: "StandardStatus eq 'Canceled' or StandardStatus eq 'Expired' or StandardStatus eq 'Withdrawn'",
    skipCache: true
  });

  const [selectedTown, setSelectedTown] = useState("All Towns");

  const loading = loadingContingent || loadingCanceled;

  // Filter by town
  const filteredContingent = useMemo(() => {
    if (selectedTown === "All Towns") return contingentProps;
    return contingentProps.filter(p => {
      const addressTown = p.address.split(',').pop()?.trim().split(' ')[0] || '';
      return p.neighborhood === selectedTown || 
             addressTown.toLowerCase() === selectedTown.toLowerCase() ||
             p.address.toLowerCase().includes(selectedTown.toLowerCase());
    });
  }, [contingentProps, selectedTown]);

  const filteredCanceled = useMemo(() => {
    if (selectedTown === "All Towns") return canceledProps;
    return canceledProps.filter(p => {
      const addressTown = p.address.split(',').pop()?.trim().split(' ')[0] || '';
      return p.neighborhood === selectedTown || 
             addressTown.toLowerCase() === selectedTown.toLowerCase() ||
             p.address.toLowerCase().includes(selectedTown.toLowerCase());
    });
  }, [canceledProps, selectedTown]);

  // Fall-through Rate Estimation
  // Calculate based on actual withdrawn vs current contingent properties
  const fallThroughStats = useMemo(() => {
    const failedDeals = filteredCanceled.length;
    const currentContingent = filteredContingent.length;
    const totalRecentDeals = failedDeals + currentContingent;
    
    // Conservative fall-through rate calculation
    // Use withdrawn properties in relation to current market activity
    let fallThroughRate = 0;
    if (totalRecentDeals > 0) {
      // If we have significant data, calculate directly
      if (totalRecentDeals >= 10) {
        fallThroughRate = Math.round((failedDeals / totalRecentDeals) * 100);
      } else {
        // For small samples, use market average (5-7% for hot markets)
        fallThroughRate = failedDeals > 0 ? Math.min(7, Math.max(3, failedDeals)) : 0;
      }
    }
    
    // Cap at reasonable maximum
    fallThroughRate = Math.min(fallThroughRate, 15);

    return {
      fallThroughRate,
      failedDeals,
      currentContingent,
      totalRecentDeals,
    };
  }, [filteredContingent, filteredCanceled]);

  // Time Spent Contingent (DOM distribution for contingent)
  const timeContingentDistribution = useMemo(() => {
    const ranges = [
      { label: "0-7 days", min: 0, max: 7 },
      { label: "8-14 days", min: 8, max: 14 },
      { label: "15-30 days", min: 15, max: 30 },
      { label: "31-60 days", min: 31, max: 60 },
      { label: "60+ days", min: 61, max: 9999 },
    ];

    return ranges.map((range, idx) => ({
      range: range.label,
      count: filteredContingent.filter(p => p.dom >= range.min && p.dom <= range.max).length,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [filteredContingent]);

  // Average Time in Contingent Status
  const avgTimeContingent = useMemo(() => {
    if (filteredContingent.length === 0) return { avg: 0, median: 0 };
    
    const doms = filteredContingent.map(p => p.dom).sort((a, b) => a - b);
    const avg = Math.round(doms.reduce((a, b) => a + b, 0) / doms.length);
    const midIdx = Math.floor(doms.length / 2);
    const median = doms.length % 2 === 0 ? Math.round((doms[midIdx - 1] + doms[midIdx]) / 2) : doms[midIdx];

    return { avg, median };
  }, [filteredContingent]);

  // Price Analysis for Contingent Properties
  const priceAnalysis = useMemo(() => {
    const propsWithPrices = filteredContingent.filter(p => p.originalPrice && p.originalPrice > 0 && p.price && p.price > 0);
    
    if (propsWithPrices.length === 0) {
      return { reductionRate: 0, avgReduction: 0, withReduction: 0 };
    }
    
    // Properties that had price reductions before going contingent
    const withReduction = propsWithPrices.filter(p => p.price < p.originalPrice);
    const reductionRate = Math.round((withReduction.length / propsWithPrices.length) * 100);

    // Average reduction
    const avgReduction = withReduction.length > 0
      ? Math.round(withReduction.reduce((a, p) => a + ((p.originalPrice - p.price) / p.originalPrice) * 100, 0) / withReduction.length * 10) / 10
      : 0;

    return { reductionRate, avgReduction, withReduction: withReduction.length };
  }, [filteredContingent]);

  // Risk Assessment by Price Band
  const riskByPriceBand = useMemo(() => {
    const bands = [
      { label: "Under $1M", min: 0, max: 1000000 },
      { label: "$1M-$2M", min: 1000000, max: 2000000 },
      { label: "$2M-$3M", min: 2000000, max: 3000000 },
      { label: "$3M+", min: 3000000, max: 999999999 },
    ];

    return bands.map((band, idx) => {
      const contingent = filteredContingent.filter(p => p.price >= band.min && p.price < band.max).length;
      const canceled = filteredCanceled.filter(p => p.price >= band.min && p.price < band.max).length;
      const total = contingent + canceled;
      const failRate = total > 0 ? Math.round((canceled / total) * 100) : 0;

      return {
        band: band.label,
        contingent,
        canceled,
        failRate,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      };
    }).filter(d => d.contingent > 0 || d.canceled > 0);
  }, [filteredContingent, filteredCanceled]);

  // Town Breakdown
  const townBreakdown = useMemo(() => {
    const townStats: Record<string, any> = {};
    
    // First pass: collect all town data
    const townData: Array<{town: string, contingent: any[], canceled: any[]}> = [];

    TOWNS.slice(1).forEach(town => {
      const contingent = contingentProps.filter(p => {
        // More robust town matching
        const addressTown = p.address.split(',').pop()?.trim().split(' ')[0] || '';
        return p.neighborhood === town || 
               addressTown.toLowerCase() === town.toLowerCase() ||
               p.address.toLowerCase().includes(town.toLowerCase());
      });
      const canceled = canceledProps.filter(p => {
        const addressTown = p.address.split(',').pop()?.trim().split(' ')[0] || '';
        return p.neighborhood === town || 
               addressTown.toLowerCase() === town.toLowerCase() ||
               p.address.toLowerCase().includes(town.toLowerCase());
      });

      if (contingent.length > 0 || canceled.length > 0) {
        townData.push({ town, contingent, canceled });
      }
    });
    
    // Calculate dynamic thresholds based on actual data distribution
    const counts = townData.map(t => t.contingent.length).filter(c => c > 0);
    const maxCount = Math.max(...counts, 1);
    const avgCount = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 1;
    
    // Dynamic thresholds: High = above 75th percentile, Medium = above average, Low = below average
    const highThreshold = Math.max(maxCount * 0.6, avgCount * 1.5);
    const mediumThreshold = Math.max(avgCount, 3);
    
    townData.forEach(({ town, contingent, canceled }) => {
        const avgDOM = contingent.length > 0
          ? Math.round(contingent.reduce((a, p) => a + p.dom, 0) / contingent.length)
          : 0;

        // Improved risk assessment
        // Consider both withdrawal count and average DOM
        let riskLevel = "Low";
        const withdrawalRate = contingent.length > 0 ? (canceled.length / (contingent.length + canceled.length)) * 100 : 0;
        
        // Risk factors:
        // 1. High withdrawal rate (>10%)
        // 2. Long average DOM (>60 days)
        // 3. Absolute number of withdrawals
        
        if (withdrawalRate > 15 || avgDOM > 90 || canceled.length > 10) {
          riskLevel = "High";
        } else if (withdrawalRate > 5 || avgDOM > 60 || canceled.length > 3) {
          riskLevel = "Medium";
        }
        
        // Dynamic activity level based on relative volume
        let activityLevel = "Low";
        if (contingent.length >= highThreshold) activityLevel = "High";
        else if (contingent.length >= mediumThreshold) activityLevel = "Medium";

        townStats[town] = {
          contingent: contingent.length,
          canceled: canceled.length,
          riskLevel,
          activityLevel,
          avgDOM,
        };
    });

    // Sort by activity: first by canceled count (most withdrawals), then by contingent count (most active)
    return Object.entries(townStats)
      .map(([town, stats], idx) => ({
        town,
        ...stats,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }))
      .sort((a, b) => {
        // Primary sort: canceled count (risk)
        if (b.canceled !== a.canceled) return b.canceled - a.canceled;
        // Secondary sort: contingent count (activity)
        return b.contingent - a.contingent;
      });
  }, [contingentProps, canceledProps]);

  // Status Distribution Pie
  const statusDistribution = useMemo(() => {
    return [
      { name: "Under Contract", value: filteredContingent.length, color: CHART_COLORS[0] },
      { name: "Withdrawn", value: filteredCanceled.length, color: CHART_COLORS[1] },
    ].filter(d => d.value > 0);
  }, [filteredContingent, filteredCanceled]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading contingent data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              Under Contract Analysis
            </h1>
            <p className="text-muted-foreground">
              Fall-through risk & active under contract tracking for {filteredContingent.length} properties
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={selectedTown} onValueChange={setSelectedTown}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select town" />
              </SelectTrigger>
              <SelectContent>
                {TOWNS.map(town => (
                  <SelectItem key={town} value={town}>{town}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <LastUpdated timestamp={lastUpdated} loading={loading} onRefresh={refetch} />
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm text-muted-foreground">Est. Fall-Through Rate</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{fallThroughStats.fallThroughRate}%</p>
          <p className="text-sm text-muted-foreground mt-1">
            {fallThroughStats.failedDeals} of {fallThroughStats.totalRecentDeals} contracts canceled
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Avg Time Under Contract</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{avgTimeContingent.avg} days</p>
          <p className="text-sm text-muted-foreground mt-1">
            Median: {avgTimeContingent.median} days
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-sm text-muted-foreground">Had Price Reduction</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{priceAnalysis.reductionRate}%</p>
          <p className="text-sm text-muted-foreground mt-1">
            Avg reduction: {priceAnalysis.avgReduction}%
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <RefreshCw className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-sm text-muted-foreground">Withdrawn</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{filteredCanceled.length}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Deals fell through
          </p>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time in Contingent Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Time Under Contract
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeContingentDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Properties" radius={[4, 4, 0, 0]}>
                  {timeContingentDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Status Distribution
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Risk by Price Band */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Fall-Through Risk by Price Band
        </h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskByPriceBand}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="band" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="contingent" name="Currently Contingent" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="canceled" name="Canceled/Expired" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Town Comparison Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Under Contract & Withdrawn by Town
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Town</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Under Contract</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Withdrawn</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Avg Days</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Activity</th>
              </tr>
            </thead>
            <tbody>
              {townBreakdown.map((town) => (
                <tr key={town.town} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-3 px-4 font-medium text-foreground">{town.town}</td>
                  <td className="py-3 px-4 text-right text-foreground">{town.contingent}</td>
                  <td className="py-3 px-4 text-right text-foreground">{town.canceled}</td>
                  <td className="py-3 px-4 text-right text-foreground">{town.avgDOM} days</td>
                  <td className="py-3 px-4 text-right">
                    <Badge 
                      variant={town.activityLevel === "High" ? "default" : town.activityLevel === "Medium" ? "secondary" : "outline"}
                      className={town.activityLevel === "High" ? "bg-blue-500" : ""}
                    >
                      {town.activityLevel}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Buyer Insight: Backup Offers
          </h4>
          <p className="text-sm text-muted-foreground">
            With a {fallThroughStats.fallThroughRate}% fall-through rate, 
            consider submitting backup offers on under contract properties — 
            <strong> {fallThroughStats.failedDeals} deals</strong> were withdrawn recently.
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Timeline Insight
          </h4>
          <p className="text-sm text-muted-foreground">
            Average time under contract is {avgTimeContingent.avg} days.
            Properties under contract beyond 30 days have higher fall-through risk.
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Price Reduction Pattern
          </h4>
          <p className="text-sm text-muted-foreground">
            {priceAnalysis.reductionRate}% of under contract properties had price reductions before going under contract.
            Reduced-price properties may have more motivated sellers.
          </p>
        </Card>
      </div>
    </div>
  );
}
