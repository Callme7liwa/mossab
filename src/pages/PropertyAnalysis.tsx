import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { PropertyTable } from "@/components/analysis/PropertyTable";
import { LastUpdated } from "@/components/dashboard/LastUpdated";
import StickyFilterBar from "@/components/ui/StickyFilterBar";
import { useProperties } from "@/hooks/useProperties";
import ReportDisclaimer from "@/components/ui/ReportDisclaimer";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-foreground">{payload[0].name}</p>
        <p className="text-sm text-muted-foreground">
          Count: <span className="text-primary font-medium">{payload[0].payload.count}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Share: <span className="text-primary font-medium">{payload[0].value}%</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function PropertyAnalysis() {
  const [filters, setFilters] = useState({ propertyType: 'All', town: 'All', status: 'Active', timeframe: '12m' });
  // Show Active listings for current market analysis
  const { properties, stats, loading, refetch, lastUpdated } = useProperties({ 
    top: 500,
    propertyType: filters.propertyType === 'All' ? undefined : filters.propertyType,
    town: filters.town === 'All' ? undefined : filters.town,
    status: filters.status === 'All' ? undefined : filters.status,
    timeframe: filters.timeframe,
  } as any);

  // Calculate property type distribution from live data
  const typeDistribution = useMemo(() => {
    if (properties.length === 0) return [];
    
    const typeCounts: Record<string, number> = {};
    properties.forEach((p) => {
      const type = p.type || "Unknown";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const total = properties.length;
    return Object.entries(typeCounts)
      .map(([name, count], index) => ({
        name,
        count,
        value: Math.round((count / total) * 100),
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 types
  }, [properties]);

  // Generate dynamic insights from live data
  const insights = useMemo(() => {
    if (properties.length === 0) return [];

    const result = [];

    // Find fastest selling area
    const areaDOM: Record<string, number[]> = {};
    properties.forEach((p) => {
      if (p.neighborhood && p.dom > 0) {
        if (!areaDOM[p.neighborhood]) areaDOM[p.neighborhood] = [];
        areaDOM[p.neighborhood].push(p.dom);
      }
    });
    
    const areaAvgDOM = Object.entries(areaDOM).map(([area, doms]) => ({
      area,
      avgDOM: doms.reduce((a, b) => a + b, 0) / doms.length,
    }));
    
    if (areaAvgDOM.length > 0) {
      const fastest = areaAvgDOM.sort((a, b) => a.avgDOM - b.avgDOM)[0];
      result.push({
        type: "hot",
        title: "Hot Market",
        message: `Properties in ${fastest.area} are selling fastest (avg ${Math.round(fastest.avgDOM)} days on market).`,
      });
    }

    // Find highest priced type
    const typePrices: Record<string, number[]> = {};
    properties.forEach((p) => {
      if (p.type && p.price > 0) {
        if (!typePrices[p.type]) typePrices[p.type] = [];
        typePrices[p.type].push(p.price);
      }
    });
    
    const typeAvgPrices = Object.entries(typePrices).map(([type, prices]) => ({
      type,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
    }));
    
    if (typeAvgPrices.length > 0) {
      const highest = typeAvgPrices.sort((a, b) => b.avgPrice - a.avgPrice)[0];
      result.push({
        type: "price",
        title: "Price Alert",
        message: `${highest.type} properties have the highest avg price at $${Math.round(highest.avgPrice).toLocaleString()}.`,
      });
    }

    // Inventory insight
    if (typeDistribution.length > 0) {
      const lowest = typeDistribution[typeDistribution.length - 1];
      result.push({
        type: "inventory",
        title: "Inventory Watch",
        message: `${lowest.name} has limited inventory (${lowest.count} listings, ${lowest.value}% of market).`,
      });
    }

    return result;
  }, [properties, typeDistribution]);

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
              Property Analysis
            </h1>
            <p className="text-muted-foreground">
              Compare and analyze property listings ({stats.totalInventory} properties)
            </p>
          </div>
          <LastUpdated timestamp={lastUpdated} loading={loading} onRefresh={refetch} />
        </div>
      </motion.div>

      {/* Property Table - Full Width */}
      <PropertyTable />

      {/* Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bento-card"
        >
          <h3 className="font-display text-lg font-semibold text-foreground mb-4">
            Property Type Distribution
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {typeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-sm text-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bento-card"
        >
          <h3 className="font-display text-lg font-semibold text-foreground mb-4">
            Market Insights
          </h3>
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">No insights available</p>
            ) : (
              insights.map((insight, idx) => (
                <div
                  key={idx}
                  className={
                    insight.type === "hot"
                      ? "p-4 rounded-lg bg-primary/5 border border-primary/10"
                      : insight.type === "price"
                      ? "p-4 rounded-lg bg-accent/5 border border-accent/10"
                      : "p-4 rounded-lg bg-secondary border border-border"
                  }
                >
                  <p
                    className={
                      insight.type === "hot"
                        ? "text-sm font-medium text-primary mb-1"
                        : insight.type === "price"
                        ? "text-sm font-medium text-accent mb-1"
                        : "text-sm font-medium text-foreground mb-1"
                    }
                  >
                    {insight.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{insight.message}</p>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
      <ReportDisclaimer />
    </div>
  );
}
