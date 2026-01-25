import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  TrendingUp,
  Zap,
  Calendar,
  Home,
  Percent,
  Loader2,
  Target,
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
  LineChart,
  Line,
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

export default function PendingInsights() {
  const { properties, loading, refetch, lastUpdated } = useProperties({ 
    top: 500,
    filter: "StandardStatus eq 'Pending'",
    skipCache: true
  });
  const [selectedTown, setSelectedTown] = useState("All Towns");

  // Filter properties by selected town
  const filteredProperties = useMemo(() => {
    if (selectedTown === "All Towns") return properties;
    return properties.filter(p => p.neighborhood === selectedTown || p.address.includes(selectedTown));
  }, [properties, selectedTown]);

  // Time to Pending (DOM when they went pending)
  const timeToPendingStats = useMemo(() => {
    const doms = filteredProperties.map(p => p.dom).sort((a, b) => a - b);
    if (doms.length === 0) return { median: 0, average: 0, within14: 0, within30: 0 };

    const midIdx = Math.floor(doms.length / 2);
    const median = doms.length % 2 === 0 ? (doms[midIdx - 1] + doms[midIdx]) / 2 : doms[midIdx];
    const average = Math.round(doms.reduce((a, b) => a + b, 0) / doms.length);

    const within14 = Math.round((filteredProperties.filter(p => p.dom <= 14).length / filteredProperties.length) * 100);
    const within30 = Math.round((filteredProperties.filter(p => p.dom <= 30).length / filteredProperties.length) * 100);

    return { median: Math.round(median), average, within14, within30 };
  }, [filteredProperties]);

  // Time to Pending Distribution
  const timeToPendingDistribution = useMemo(() => {
    const ranges = [
      { label: "0-7 days", min: 0, max: 7 },
      { label: "8-14 days", min: 8, max: 14 },
      { label: "15-30 days", min: 15, max: 30 },
      { label: "31-60 days", min: 31, max: 60 },
      { label: "60+ days", min: 61, max: 9999 },
    ];

    return ranges.map((range, idx) => ({
      range: range.label,
      count: filteredProperties.filter(p => p.dom >= range.min && p.dom <= range.max).length,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [filteredProperties]);

  // Property Characteristics that go pending fastest
  const fastestCharacteristics = useMemo(() => {
    // By bedroom count
    const byBeds: Record<string, { count: number; avgDOM: number }> = {};
    filteredProperties.forEach(p => {
      const beds = `${p.beds} BR`;
      if (!byBeds[beds]) byBeds[beds] = { count: 0, avgDOM: 0 };
      byBeds[beds].count++;
      byBeds[beds].avgDOM += p.dom;
    });

    const bedsData = Object.entries(byBeds)
      .map(([beds, data]) => ({
        category: beds,
        avgDOM: Math.round(data.avgDOM / data.count),
        count: data.count,
      }))
      .filter(d => d.count >= 2) // Filter out categories with very small sample sizes
      .sort((a, b) => a.avgDOM - b.avgDOM);

    // By price band
    const priceBands = [
      { label: "Under $1M", min: 0, max: 1000000 },
      { label: "$1M-$2M", min: 1000000, max: 2000000 },
      { label: "$2M-$3M", min: 2000000, max: 3000000 },
      { label: "$3M+", min: 3000000, max: 999999999 },
    ];

    const priceData = priceBands.map(band => {
      const props = filteredProperties.filter(p => p.price >= band.min && p.price < band.max);
      const avgDOM = props.length > 0 
        ? Math.round(props.reduce((a, p) => a + p.dom, 0) / props.length)
        : 0;
      return {
        category: band.label,
        avgDOM,
        count: props.length,
      };
    }).filter(d => d.count > 0);

    return { bedsData, priceData };
  }, [filteredProperties]);

  // Absorption Velocity (% that went pending within 14/30 days)
  const absorptionVelocity = useMemo(() => {
    return {
      within14Days: timeToPendingStats.within14,
      within30Days: timeToPendingStats.within30,
      avgDaysToPending: timeToPendingStats.median,
    };
  }, [timeToPendingStats]);

  // Town Breakdown
  const townBreakdown = useMemo(() => {
    const townStats: Record<string, { count: number; medianDOM: number; avgPrice: number }> = {};

    TOWNS.slice(1).forEach(town => {
      const townProps = properties.filter(p => {
        // More robust town matching
        const addressTown = p.address.split(',').pop()?.trim().split(' ')[0] || '';
        return p.neighborhood === town || 
               addressTown.toLowerCase() === town.toLowerCase() ||
               p.address.toLowerCase().includes(town.toLowerCase());
      });

      if (townProps.length > 0) {
        const doms = townProps.map(p => p.dom).sort((a, b) => a - b);
        const midIdx = Math.floor(doms.length / 2);
        const medianDOM = doms.length % 2 === 0 ? (doms[midIdx - 1] + doms[midIdx]) / 2 : doms[midIdx];
        const avgPrice = townProps.reduce((a, p) => a + p.price, 0) / townProps.length;

        townStats[town] = {
          count: townProps.length,
          medianDOM: Math.round(medianDOM),
          avgPrice: Math.round(avgPrice),
        };
      }
    });

    return Object.entries(townStats)
      .map(([town, stats], idx) => ({
        town,
        ...stats,
        speed: stats.medianDOM < 14 ? "Very Fast" : stats.medianDOM < 30 ? "Fast" : stats.medianDOM < 60 ? "Moderate" : "Slow",
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }))
      .sort((a, b) => a.medianDOM - b.medianDOM);
  }, [properties]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading pending listings...</span>
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
              Pending Listings Insights
            </h1>
            <p className="text-muted-foreground">
              Absorption velocity & time-to-pending analysis for {filteredProperties.length} pending properties
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
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Median Time to Pending</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{timeToPendingStats.median} days</p>
          <p className="text-sm text-muted-foreground mt-1">
            Avg: {timeToPendingStats.average} days
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Zap className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-sm text-muted-foreground">Pending within 14 Days</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{absorptionVelocity.within14Days}%</p>
          <p className="text-sm text-muted-foreground mt-1">
            Absorption velocity
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Target className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">Pending within 30 Days</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{absorptionVelocity.within30Days}%</p>
          <p className="text-sm text-muted-foreground mt-1">
            30-day absorption
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Home className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm text-muted-foreground">Total Pending</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{filteredProperties.length}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Under contract
          </p>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time to Pending Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Time to Pending Distribution
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeToPendingDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Properties" radius={[4, 4, 0, 0]}>
                  {timeToPendingDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* By Price Band */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Avg Days to Pending by Price Band
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fastestCharacteristics.priceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 12 }} width={80} className="text-muted-foreground" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgDOM" name="Avg Days" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* By Bedroom Count */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Home className="w-5 h-5 text-primary" />
          Time to Pending by Bedroom Count
        </h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fastestCharacteristics.bedsData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avgDOM" name="Avg Days to Pending" radius={[4, 4, 0, 0]}>
                {fastestCharacteristics.bedsData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Town Comparison Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Absorption Velocity by Town
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Town</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Pending Count</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Median Days to Pending</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Avg Price</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Speed</th>
              </tr>
            </thead>
            <tbody>
              {townBreakdown.map((town) => (
                <tr key={town.town} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-3 px-4 font-medium text-foreground">{town.town}</td>
                  <td className="py-3 px-4 text-right text-foreground">{town.count}</td>
                  <td className="py-3 px-4 text-right text-foreground">{town.medianDOM} days</td>
                  <td className="py-3 px-4 text-right text-foreground">
                    ${(town.avgPrice / 1000000).toFixed(2)}M
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Badge 
                      variant={town.speed === "Very Fast" || town.speed === "Fast" ? "default" : town.speed === "Moderate" ? "secondary" : "outline"}
                      className={town.speed === "Very Fast" || town.speed === "Fast" ? "bg-green-500" : ""}
                    >
                      {town.speed}
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
        <Card className="p-6 bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-green-500" />
            Client Insight: Offer Speed
          </h4>
          <p className="text-sm text-muted-foreground">
            {absorptionVelocity.within14Days}% of properties go pending within 14 days.
            <strong> Act fast</strong> — median time to make an offer is {timeToPendingStats.median} days.
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-500" />
            Fastest Segment
          </h4>
          <p className="text-sm text-muted-foreground">
            {fastestCharacteristics.bedsData[0]?.category || "N/A"} homes go pending fastest 
            at {fastestCharacteristics.bedsData[0]?.avgDOM || 0} days average.
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" />
            Market Absorption
          </h4>
          <p className="text-sm text-muted-foreground">
            {absorptionVelocity.within30Days}% absorption rate within 30 days indicates 
            a {absorptionVelocity.within30Days > 70 ? "strong seller's" : absorptionVelocity.within30Days > 50 ? "balanced" : "buyer's"} market.
          </p>
        </Card>
      </div>
    </div>
  );
}
