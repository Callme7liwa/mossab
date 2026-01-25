import { useMemo } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Home, Clock, Loader2 } from "lucide-react";
import { KPICard } from "@/components/dashboard/KPICard";
import { PriceTrendChart } from "@/components/dashboard/PriceTrendChart";
import { MapPlaceholder } from "@/components/dashboard/MapPlaceholder";
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
} from "recharts";

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
        <p className="text-sm text-muted-foreground">
          Listings: <span className="text-primary font-medium">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function MarketOverview() {
  // Show Active listings for current market overview
  const { properties, stats, loading, error } = useProperties({ 
    top: 500,
    filter: "StandardStatus eq 'Active'"
  });

  // Calculate inventory by property type from live data
  const inventoryData = useMemo(() => {
    if (properties.length === 0) return [];

    const typeCount: Record<string, number> = {};
    properties.forEach((p) => {
      const type = p.type || "Unknown";
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    return Object.entries(typeCount)
      .map(([type, count], index) => ({
        type: type.length > 12 ? type.slice(0, 12) + "..." : type,
        fullType: type,
        listings: count,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((a, b) => b.listings - a.listings)
      .slice(0, 6); // Top 6 property types
  }, [properties]);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `$${Math.round(price / 1000)}K`;
    return `$${price}`;
  };

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
              Market Overview
            </h1>
            <p className="text-muted-foreground">
              Real-time insights into the residential real estate market
            </p>
          </div>
        </div>
        {error && (
          <p className="text-sm text-destructive mt-2">Error: {error}</p>
        )}
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Median Listing Price"
          value={loading ? "Loading..." : formatPrice(stats.medianPrice)}
          change="Live data"
          changeType="neutral"
          icon={DollarSign}
          delay={0}
        />
        <KPICard
          title="Price per Sq Ft"
          value={loading ? "Loading..." : `$${stats.avgPricePerSqft}`}
          change="Live data"
          changeType="neutral"
          icon={TrendingUp}
          delay={0.05}
        />
        <KPICard
          title="Active Inventory"
          value={loading ? "Loading..." : stats.totalInventory.toLocaleString()}
          change="From API"
          changeType="neutral"
          icon={Home}
          delay={0.1}
        />
        <KPICard
          title="Avg Days on Market"
          value={loading ? "Loading..." : stats.avgDaysOnMarket.toString()}
          change="Live data"
          changeType="neutral"
          icon={Clock}
          delay={0.15}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PriceTrendChart />
        <MapPlaceholder />
      </div>

      {/* Inventory Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="bento-card"
      >
        <div className="mb-6">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Inventory by Property Type
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Active listings by property type
          </p>
        </div>
        <div className="h-[250px]">
          {loading && inventoryData.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="type"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="listings" radius={[6, 6, 0, 0]}>
                  {inventoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>
    </div>
  );
}
