import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  XCircle,
  Clock,
  RefreshCw,
  TrendingDown,
  Home,
  Loader2,
  AlertCircle,
  BarChart3,
  Percent,
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

export default function WithdrawnAnalysis() {
  // Fetch Withdrawn properties
  const { properties: withdrawnProps, loading: loadingWithdrawn, refetch, lastUpdated } = useProperties({ 
    top: 500,
    filter: "StandardStatus eq 'Withdrawn'",
    skipCache: true
  });

  // Also fetch Active for total market comparison
  const { properties: activeProps, loading: loadingActive } = useProperties({ 
    top: 1000,
    filter: "StandardStatus eq 'Active'",
    skipCache: true
  });

  const [selectedTown, setSelectedTown] = useState("All Towns");

  const loading = loadingWithdrawn || loadingActive;

  // Filter by town - improved matching
  const filteredWithdrawn = useMemo(() => {
    if (selectedTown === "All Towns") return withdrawnProps;
    return withdrawnProps.filter(p => {
      const addressTown = p.address.split(',').pop()?.trim().split(' ')[0] || '';
      return p.neighborhood === selectedTown || 
             addressTown.toLowerCase() === selectedTown.toLowerCase() ||
             p.address.toLowerCase().includes(selectedTown.toLowerCase());
    });
  }, [withdrawnProps, selectedTown]);

  const filteredActive = useMemo(() => {
    if (selectedTown === "All Towns") return activeProps;
    return activeProps.filter(p => {
      const addressTown = p.address.split(',').pop()?.trim().split(' ')[0] || '';
      return p.neighborhood === selectedTown || 
             addressTown.toLowerCase() === selectedTown.toLowerCase() ||
             p.address.toLowerCase().includes(selectedTown.toLowerCase());
    });
  }, [activeProps, selectedTown]);

  // Withdrawn as % of Total Market
  const withdrawnPercent = useMemo(() => {
    const total = filteredWithdrawn.length + filteredActive.length;
    return total > 0 ? Math.round((filteredWithdrawn.length / total) * 100 * 10) / 10 : 0;
  }, [filteredWithdrawn, filteredActive]);

  // DOM Before Withdrawal Distribution
  const domBeforeWithdrawal = useMemo(() => {
    const ranges = [
      { label: "0-14 days", min: 0, max: 14 },
      { label: "15-30 days", min: 15, max: 30 },
      { label: "31-60 days", min: 31, max: 60 },
      { label: "61-90 days", min: 61, max: 90 },
      { label: "90+ days", min: 91, max: 9999 },
    ];

    return ranges.map((range, idx) => ({
      range: range.label,
      count: filteredWithdrawn.filter(p => p.dom >= range.min && p.dom <= range.max).length,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [filteredWithdrawn]);

  // Average DOM Before Withdrawal
  const avgDOMStats = useMemo(() => {
    if (filteredWithdrawn.length === 0) return { avg: 0, median: 0 };
    
    const doms = filteredWithdrawn.map(p => p.dom).sort((a, b) => a - b);
    const avg = Math.round(doms.reduce((a, b) => a + b, 0) / doms.length);
    const midIdx = Math.floor(doms.length / 2);
    const median = doms.length % 2 === 0 ? Math.round((doms[midIdx - 1] + doms[midIdx]) / 2) : doms[midIdx];

    return { avg, median };
  }, [filteredWithdrawn]);

  // Re-list Behavior Analysis
  // Properties with MLSPIN_PREV_MARKET_TIME > 0 have been listed before
  const relistBehavior = useMemo(() => {
    if (filteredWithdrawn.length === 0) {
      return { relistRate: 0, withHistory: 0, avgPrevDOM: 0 };
    }
    
    const withPrevTime = filteredWithdrawn.filter(p => p.prevMarketTime && p.prevMarketTime > 0);
    const relistRate = Math.round((withPrevTime.length / filteredWithdrawn.length) * 100);

    // Avg previous DOM
    const avgPrevDOM = withPrevTime.length > 0
      ? Math.round(withPrevTime.reduce((a, p) => a + (p.prevMarketTime || 0), 0) / withPrevTime.length)
      : 0;

    return { 
      relistRate, 
      withHistory: withPrevTime.length,
      avgPrevDOM,
    };
  }, [filteredWithdrawn]);

  // Price Changes Before Withdrawal
  const priceChangeStats = useMemo(() => {
    const withPrices = filteredWithdrawn.filter(p => p.originalPrice && p.originalPrice > 0 && p.price && p.price > 0);
    if (withPrices.length === 0) {
      return { reductionRate: 0, avgReduction: 0 };
    }
    
    const withReduction = withPrices.filter(p => p.price < p.originalPrice);
    const reductionRate = Math.round((withReduction.length / withPrices.length) * 100);

    const avgReduction = withReduction.length > 0
      ? Math.round(withReduction.reduce((a, p) => a + ((p.originalPrice - p.price) / p.originalPrice) * 100, 0) / withReduction.length * 10) / 10
      : 0;

    return { reductionRate, avgReduction };
  }, [filteredWithdrawn]);

  // By Price Band
  const byPriceBand = useMemo(() => {
    const bands = [
      { label: "Under $1M", min: 0, max: 1000000 },
      { label: "$1M-$2M", min: 1000000, max: 2000000 },
      { label: "$2M-$3M", min: 2000000, max: 3000000 },
      { label: "$3M+", min: 3000000, max: 999999999 },
    ];

    return bands.map((band, idx) => {
      const withdrawn = filteredWithdrawn.filter(p => p.price >= band.min && p.price < band.max).length;
      const active = filteredActive.filter(p => p.price >= band.min && p.price < band.max).length;
      const total = withdrawn + active;
      const withdrawnPct = total > 0 ? Math.round((withdrawn / total) * 100) : 0;

      return {
        band: band.label,
        withdrawn,
        active,
        withdrawnPct,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      };
    }).filter(d => d.withdrawn > 0 || d.active > 0);
  }, [filteredWithdrawn, filteredActive]);

  // Town Breakdown
  const townBreakdown = useMemo(() => {
    const townStats: Record<string, any> = {};

    TOWNS.slice(1).forEach(town => {
      const withdrawn = withdrawnProps.filter(p => {
        const addressTown = p.address.split(',').pop()?.trim().split(' ')[0] || '';
        return p.neighborhood === town || 
               addressTown.toLowerCase() === town.toLowerCase() ||
               p.address.toLowerCase().includes(town.toLowerCase());
      });
      const active = activeProps.filter(p => {
        const addressTown = p.address.split(',').pop()?.trim().split(' ')[0] || '';
        return p.neighborhood === town || 
               addressTown.toLowerCase() === town.toLowerCase() ||
               p.address.toLowerCase().includes(town.toLowerCase());
      });

      if (withdrawn.length > 0 || active.length > 0) {
        const total = withdrawn.length + active.length;
        const withdrawnPct = total > 0 ? Math.round((withdrawn.length / total) * 100 * 10) / 10 : 0;
        
        const avgDOM = withdrawn.length > 0
          ? Math.round(withdrawn.reduce((a, p) => a + p.dom, 0) / withdrawn.length)
          : 0;

        // Check for re-lists
        const withHistory = withdrawn.filter(p => p.prevMarketTime && p.prevMarketTime > 0).length;

        townStats[town] = {
          withdrawn: withdrawn.length,
          active: active.length,
          withdrawnPct,
          avgDOM,
          withHistory,
        };
      }
    });

    return Object.entries(townStats)
      .map(([town, stats], idx) => ({
        town,
        ...stats,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }))
      .sort((a, b) => b.withdrawnPct - a.withdrawnPct);
  }, [withdrawnProps, activeProps]);

  // Why Withdrawals Happen (MUTUALLY EXCLUSIVE categories for accurate pie chart)
  const withdrawalReasons = useMemo(() => {
    // Categorize each property into ONE category only (priority order)
    let changedMind = 0;      // <14 days, no price reduction
    let failedReduction = 0;  // Had price reduction (regardless of DOM)
    let pricingIssues = 0;    // >60 days, no price reduction
    let other = 0;            // 14-60 days, no price reduction

    filteredWithdrawn.forEach(p => {
      const hadReduction = p.price < p.originalPrice;
      
      if (p.dom < 14 && !hadReduction) {
        changedMind++;
      } else if (hadReduction) {
        failedReduction++;
      } else if (p.dom > 60) {
        pricingIssues++;
      } else {
        other++;
      }
    });

    const results = [
      { reason: "Pricing Issues (>60 days)", count: pricingIssues, color: CHART_COLORS[0] },
      { reason: "Failed Price Reduction", count: failedReduction, color: CHART_COLORS[1] },
      { reason: "Changed Mind (<14 days)", count: changedMind, color: CHART_COLORS[2] },
    ];
    
    // Only add "other" if significant
    if (other > 0) {
      results.push({ reason: "Moderate DOM (14-60 days)", count: other, color: CHART_COLORS[3] });
    }

    return results.filter(d => d.count > 0);
  }, [filteredWithdrawn]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading withdrawn data...</span>
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
              Withdrawn Analysis
            </h1>
            <p className="text-muted-foreground">
              Withdrawal patterns, re-list behavior & market signals for {filteredWithdrawn.length} withdrawn listings
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
            <div className="p-2 rounded-lg bg-red-500/10">
              <Percent className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-sm text-muted-foreground">% of Market Withdrawn</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{withdrawnPercent}%</p>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredWithdrawn.length} of {filteredWithdrawn.length + filteredActive.length} listings
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Avg DOM Before Withdrawal</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{avgDOMStats.avg} days</p>
          <p className="text-sm text-muted-foreground mt-1">
            Median: {avgDOMStats.median} days
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <RefreshCw className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm text-muted-foreground">Have Re-list History</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{relistBehavior.relistRate}%</p>
          <p className="text-sm text-muted-foreground mt-1">
            {relistBehavior.withHistory} properties
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <TrendingDown className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">Had Price Reduction</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{priceChangeStats.reductionRate}%</p>
          <p className="text-sm text-muted-foreground mt-1">
            Avg reduction: {priceChangeStats.avgReduction}%
          </p>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DOM Before Withdrawal */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Days on Market Before Withdrawal
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domBeforeWithdrawal}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Properties" radius={[4, 4, 0, 0]}>
                  {domBeforeWithdrawal.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Withdrawal Reason Indicators */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            Withdrawal Pattern Indicators
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={withdrawalReasons}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="reason"
                  label={({ reason, percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {withdrawalReasons.map((entry, index) => (
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

      {/* Withdrawal Rate by Price Band */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <XCircle className="w-5 h-5 text-primary" />
          Withdrawal Rate by Price Band
        </h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byPriceBand}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="band" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="withdrawn" name="Withdrawn" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="active" name="Active" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Town Comparison Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Withdrawal Rate by Town
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Town</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Withdrawn</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Active</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">% Withdrawn</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Avg DOM</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Re-lists</th>
              </tr>
            </thead>
            <tbody>
              {townBreakdown.map((town) => (
                <tr key={town.town} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-3 px-4 font-medium text-foreground">{town.town}</td>
                  <td className="py-3 px-4 text-right text-foreground">{town.withdrawn}</td>
                  <td className="py-3 px-4 text-right text-foreground">{town.active}</td>
                  <td className="py-3 px-4 text-right text-foreground">
                    <span className={town.withdrawnPct > 15 ? "text-red-500" : ""}>
                      {town.withdrawnPct}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-foreground">{town.avgDOM} days</td>
                  <td className="py-3 px-4 text-right text-foreground">{town.withHistory}</td>
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
            <RefreshCw className="w-4 h-4 text-amber-500" />
            Re-list Opportunity
          </h4>
          <p className="text-sm text-muted-foreground">
            {relistBehavior.relistRate}% of withdrawn properties have been listed before.
            Watch for these to re-list — sellers may be more motivated after {relistBehavior.avgPrevDOM} days average on previous attempt.
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Timing Pattern
          </h4>
          <p className="text-sm text-muted-foreground">
            Average of {avgDOMStats.avg} days before withdrawal.
            {avgDOMStats.avg > 60 
              ? " Most withdrawals are pricing-related failures." 
              : avgDOMStats.avg < 21 
                ? " Many are quick withdrawals — possibly changed minds."
                : " Mixed reasons for withdrawal."}
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Price Reduction Signal
          </h4>
          <p className="text-sm text-muted-foreground">
            {priceChangeStats.reductionRate}% had price reductions before withdrawing.
            These sellers tried to sell, failed, and may return with more realistic expectations.
          </p>
        </Card>
      </div>
    </div>
  );
}
