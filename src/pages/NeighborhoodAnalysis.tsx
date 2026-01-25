import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  TrendingUp,
  TrendingDown,
  Home,
  Clock,
  DollarSign,
  Loader2,
  BarChart3,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

interface NeighborhoodStats {
  name: string;
  count: number;
  avgPrice: number;
  avgDOM: number;
  avgPricePerSqft: number;
  minPrice: number;
  maxPrice: number;
  activity: "hot" | "warm" | "cool";
}

export default function NeighborhoodAnalysis() {
  // Show Active listings for current neighborhood analysis
  const { properties, loading, refetch, lastUpdated } = useProperties({ 
    top: 500,
    filter: "StandardStatus eq 'Active'"
  });
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);

  const neighborhoods = useMemo<NeighborhoodStats[]>(() => {
    if (properties.length === 0) return [];

    const grouped: Record<string, typeof properties> = {};
    properties.forEach((p) => {
      const area = p.neighborhood || "Unknown";
      if (!grouped[area]) grouped[area] = [];
      grouped[area].push(p);
    });

    const stats = Object.entries(grouped)
      .filter(([name]) => name !== "Unknown")
      .map(([name, props]) => {
        const prices = props.map((p) => p.price).filter(p => !isNaN(p) && p > 0);
        const doms = props.map((p) => p.dom).filter(d => !isNaN(d) && d >= 0);
        const pricePerSqfts = props
          .map((p) => p.price / p.sqft)
          .filter(p => !isNaN(p) && isFinite(p) && p > 0);

        if (prices.length === 0 || doms.length === 0) {
          return null; // Skip neighborhoods with invalid data
        }

        const avgDOM = doms.reduce((a, b) => a + b, 0) / doms.length;
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

        let activity: "hot" | "warm" | "cool" = "cool";
        if (avgDOM < 45 && props.length >= 2) activity = "hot";
        else if (avgDOM < 90) activity = "warm";

        return {
          name,
          count: props.length,
          avgPrice: Math.round(avgPrice),
          avgDOM: Math.round(avgDOM),
          avgPricePerSqft: pricePerSqfts.length > 0 
            ? Math.round(pricePerSqfts.reduce((a, b) => a + b, 0) / pricePerSqfts.length)
            : 0,
          minPrice: Math.min(...prices),
          maxPrice: Math.max(...prices),
          activity,
        };
      })
      .filter((stat): stat is NeighborhoodStats => stat !== null)
      .sort((a, b) => b.count - a.count);

    return stats;
  }, [properties]);

  const selectedStats = useMemo(() => {
    return neighborhoods.find((n) => n.name === selectedNeighborhood);
  }, [neighborhoods, selectedNeighborhood]);

  const hotMarketsCount = useMemo(() => {
    return neighborhoods.filter((n) => n.activity === "hot").length;
  }, [neighborhoods]);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `$${Math.round(price / 1000)}K`;
    return `$${price}`;
  };

  const chartData = useMemo(() => {
    return neighborhoods.slice(0, 8).map((n, idx) => ({
      name: n.name.length > 15 ? n.name.slice(0, 12) + "..." : n.name,
      fullName: n.name,
      listings: n.count,
      avgPrice: n.avgPrice,
      avgDOM: n.avgDOM,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [neighborhoods]);

  const activityData = useMemo(() => {
    const hot = neighborhoods.filter((n) => n.activity === "hot").length;
    const warm = neighborhoods.filter((n) => n.activity === "warm").length;
    const cool = neighborhoods.filter((n) => n.activity === "cool").length;
    return [
      { name: "Hot Markets", value: hot, color: "hsl(var(--primary))" },
      { name: "Warm Markets", value: warm, color: "hsl(var(--chart-2))" },
      { name: "Cool Markets", value: cool, color: "hsl(var(--chart-3))" },
    ].filter((d) => d.value > 0);
  }, [neighborhoods]);

  return (
    <div className="space-y-6 py-6 px-2">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              Neighborhood Analysis
            </h1>
            <p className="text-muted-foreground">
              Deep dive into market stats by neighborhood
            </p>
          </div>
          <LastUpdated timestamp={lastUpdated} loading={loading} onRefresh={refetch} />
        </div>
      </motion.div>

      {loading && neighborhoods.length === 0 ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Listings by Neighborhood */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bento-card lg:col-span-2"
            >
              <h3 className="font-display text-lg font-semibold text-foreground mb-4">
                Listings by Neighborhood
              </h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      opacity={0.5}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                              <p className="font-semibold text-foreground">{data.fullName}</p>
                              <p className="text-sm text-muted-foreground">
                                Listings: <span className="text-primary">{data.listings}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Avg Price: <span className="text-primary">{formatPrice(data.avgPrice)}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Avg DOM: <span className="text-primary">{data.avgDOM} days</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="listings"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(data) => setSelectedNeighborhood(data.fullName)}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          opacity={
                            selectedNeighborhood && selectedNeighborhood !== entry.fullName
                              ? 0.4
                              : 1
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Market Activity Pie */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bento-card flex flex-col min-h-[300px]"
            >
              <h3 className="font-display text-lg font-semibold text-foreground mb-4">
                Market Activity
              </h3>
              <div className="flex-1 flex items-end">
                <div className="w-full" style={{ height: 'auto', minHeight: '280px' }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={activityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                      >
                        {activityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0];
                            const total = activityData.reduce((sum, item) => sum + item.value, 0);
                            const dataValue = Number(data.value) || 0;
                            const percentage = total > 0 ? (dataValue / total * 100).toFixed(1) : '0';
                            return (
                              <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                                <p className="font-semibold text-foreground">{data.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Count: <span className="text-primary">{data.value}</span>
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Percentage: <span className="text-primary">{percentage}%</span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        formatter={(value) => (
                          <span className="text-sm text-foreground">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Overview Cards - Moved to Bottom */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bento-card"
            >
              <div className="flex items-center gap-3 p-4">
                <div className="p-3 rounded-lg bg-primary/10 flex-shrink-0">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div className="min-h-[80px] flex flex-col justify-center flex-1">
                  <p className="text-3xl font-bold text-foreground leading-none mb-1">{neighborhoods.length}</p>
                  <p className="text-sm text-muted-foreground whitespace-nowrap">Neighborhoods</p>
                </div>
              </div>
            </motion.div>
            <motion.div
              key={`hot-markets-${hotMarketsCount}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bento-card"
            >
              <div className="flex items-center gap-3 p-4">
                <div className="p-3 rounded-lg bg-chart-1/10 flex-shrink-0">
                  <TrendingUp className="w-6 h-6 text-chart-1" />
                </div>
                <div className="min-h-[80px] flex flex-col justify-center flex-1">
                  <p className="text-3xl font-bold text-foreground leading-none mb-1">
                    {hotMarketsCount}
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-nowrap">Hot Markets</p>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bento-card"
            >
              <div className="flex items-center gap-3 p-4">
                <div className="p-3 rounded-lg bg-chart-3/10 flex-shrink-0">
                  <BarChart3 className="w-6 h-6 text-chart-3" />
                </div>
                <div className="min-h-[80px] flex flex-col justify-center flex-1">
                  <p className="text-3xl font-bold text-foreground leading-none mb-1">
                    {neighborhoods.length > 0
                      ? formatPrice(
                          Math.round(
                            neighborhoods.reduce((a, b) => a + b.avgPrice, 0) /
                              neighborhoods.length
                          )
                        )
                      : "$0"}
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-nowrap">Avg Price Across All</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Selected Neighborhood Details */}
          {selectedStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bento-card"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {selectedStats.name}
                  </h3>
                  <Badge
                    variant={
                      selectedStats.activity === "hot"
                        ? "default"
                        : selectedStats.activity === "warm"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {selectedStats.activity.toUpperCase()}
                  </Badge>
                </div>
                <button
                  onClick={() => setSelectedNeighborhood(null)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Clear Selection
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="p-4">
                  <Home className="w-4 h-4 text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold text-foreground">{selectedStats.count}</p>
                  <p className="text-xs text-muted-foreground">Active Listings</p>
                </Card>
                <Card className="p-4">
                  <DollarSign className="w-4 h-4 text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {formatPrice(selectedStats.avgPrice)}
                  </p>
                  <p className="text-xs text-muted-foreground">Average Price</p>
                </Card>
                <Card className="p-4">
                  <Clock className="w-4 h-4 text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold text-foreground">{selectedStats.avgDOM}</p>
                  <p className="text-xs text-muted-foreground">Avg Days on Market</p>
                </Card>
                <Card className="p-4">
                  <TrendingDown className="w-4 h-4 text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {formatPrice(selectedStats.minPrice)}
                  </p>
                  <p className="text-xs text-muted-foreground">Min Price</p>
                </Card>
                <Card className="p-4">
                  <TrendingUp className="w-4 h-4 text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {formatPrice(selectedStats.maxPrice)}
                  </p>
                  <p className="text-xs text-muted-foreground">Max Price</p>
                </Card>
              </div>
            </motion.div>
          )}

          {/* Neighborhood Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bento-card"
          >
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              All Neighborhoods
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Neighborhood
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                      Listings
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                      Avg Price
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                      $/Sq Ft
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                      Avg DOM
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">
                      Activity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {neighborhoods.map((n, idx) => (
                    <tr
                      key={n.name}
                      className={`border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors ${
                        selectedNeighborhood === n.name ? "bg-primary/5" : ""
                      }`}
                      onClick={() => setSelectedNeighborhood(n.name)}
                    >
                      <td className="py-3 px-4 font-medium text-foreground">{n.name}</td>
                      <td className="py-3 px-4 text-right text-foreground">{n.count}</td>
                      <td className="py-3 px-4 text-right text-foreground">
                        {formatPrice(n.avgPrice)}
                      </td>
                      <td className="py-3 px-4 text-right text-foreground">
                        ${n.avgPricePerSqft}
                      </td>
                      <td className="py-3 px-4 text-right text-foreground">{n.avgDOM}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={
                            n.activity === "hot"
                              ? "default"
                              : n.activity === "warm"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {n.activity}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
