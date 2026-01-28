import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  TrendingDown,
  DollarSign,
  Percent,
  Clock,
  Loader2,
  ArrowDownRight,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LastUpdated } from "@/components/dashboard/LastUpdated";
import { useProperties } from "@/hooks/useProperties";
import StickyFilterBar from "@/components/ui/StickyFilterBar";
import ReportDisclaimer from "@/components/ui/ReportDisclaimer";
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
];

export default function PriceDropTracker() {
  const [filters, setFilters] = useState({ propertyType: 'All', town: 'All', status: 'Active', timeframe: '12m' });
  // Show Active listings to find market opportunities
  const { properties, stats, loading, refetch, lastUpdated } = useProperties({ 
    top: 500,
    propertyType: filters.propertyType === 'All' ? undefined : filters.propertyType,
    town: filters.town === 'All' ? undefined : filters.town,
    status: filters.status === 'All' ? undefined : filters.status,
    timeframe: filters.timeframe,
  } as any);

  // Calculate market opportunities - properties priced below average $/sqft
  // This indicates potential value, though not necessarily actual price reductions
  const priceDrops = useMemo(() => {
    if (properties.length === 0) return [];

    const avgPricePerSqft = stats.avgPricePerSqft || 200;

    return properties
      .filter((p) => p.sqft > 0 && p.price > 0) // Filter out invalid data
      .map((p) => {
        const pricePerSqft = p.price / p.sqft;
        const priceDiff = avgPricePerSqft - pricePerSqft;
        const percentBelow = avgPricePerSqft > 0 ? (priceDiff / avgPricePerSqft) * 100 : 0;

        // Properties priced below avg $/sqft with longer DOM may be motivated sellers
        const potentialOpportunity = percentBelow > 5 && p.dom > 15;

        // More conservative savings calculation - represents potential value difference
        // Cap the potential upside to be more realistic (max 20% of property value)
        const theoreticalSavings = priceDiff * p.sqft;
        const conservativeSavings = Math.min(theoreticalSavings, p.price * 0.20);

        return {
          ...p,
          pricePerSqft: Math.round(pricePerSqft),
          percentBelow: Math.round(Math.max(0, percentBelow)), // Ensure non-negative
          estimatedSavings: Math.round(Math.max(0, conservativeSavings)), // More realistic savings
          theoreticalValue: Math.round(Math.max(0, theoreticalSavings)), // Keep full calculation for reference
          potentialOpportunity,
        };
      })
      .filter((p) => p.percentBelow > 5 && p.percentBelow < 60) // Filter out extreme outliers
      .sort((a, b) => b.percentBelow - a.percentBelow);
  }, [properties, stats.avgPricePerSqft]);

  const dropsByRange = useMemo(() => {
    const ranges = [
      { label: "5-15%", min: 5, max: 15 },
      { label: "15-25%", min: 15, max: 25 },
      { label: "25-35%", min: 25, max: 35 },
      { label: "35%+", min: 35, max: Infinity },
    ];

    return ranges.map((range, idx) => ({
      range: range.label,
      count: priceDrops.filter(
        (p) => p.percentBelow >= range.min && 
               (range.max === Infinity ? true : p.percentBelow < range.max)
      ).length,
      color: CHART_COLORS[idx],
    }));
  }, [priceDrops]);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `$${Math.round(price / 1000)}K`;
    return `$${price}`;
  };

  const totalSavings = useMemo(() => {
    return priceDrops.reduce((sum, p) => {
      return sum + (typeof p.estimatedSavings === 'number' && !isNaN(p.estimatedSavings) ? p.estimatedSavings : 0);
    }, 0);
  }, [priceDrops]);

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
              Market Opportunities
            </h1>
            <p className="text-muted-foreground">
              Properties priced below market average - potential value opportunities
            </p>
          </div>
          <LastUpdated timestamp={lastUpdated} loading={loading} onRefresh={refetch} />
        </div>
      </motion.div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> This analysis shows properties priced below the current market average of ${stats.avgPricePerSqft}/sqft. 
            Potential savings are conservatively estimated and capped at 20% of property value. These represent value opportunities based on pricing analysis, not guaranteed returns.
          </p>
        </div>
      </motion.div>

      {loading && priceDrops.length === 0 ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <StickyFilterBar
              towns={Array.from(new Set(properties.map(p => p.city || 'Wellesley')))}
              propertyType={filters.propertyType}
              town={filters.town}
              status={filters.status}
              timeframe={filters.timeframe}
              onChange={(vals) => setFilters(prev => ({ ...prev, ...vals }))}
            />
          </div>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bento-card"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingDown className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{priceDrops.length}</p>
                  <p className="text-sm text-muted-foreground">Value Opportunities</p>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bento-card"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-chart-1/10">
                  <DollarSign className="w-5 h-5 text-chart-1" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">${stats.avgPricePerSqft}</p>
                  <p className="text-sm text-muted-foreground">Market Avg $/Sqft</p>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bento-card"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-chart-2/10">
                  <Percent className="w-5 h-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {priceDrops.length > 0
                      ? Math.round(
                          priceDrops.reduce((a, b) => a + b.percentBelow, 0) / priceDrops.length
                        )
                      : 0}
                    %
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Below Market</p>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bento-card"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-chart-3/10">
                  <ArrowDownRight className="w-5 h-5 text-chart-3" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatPrice(totalSavings)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Potential Savings</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bento-card"
          >
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Properties Below Market Average
            </h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dropsByRange} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.5}
                    horizontal={false}
                  />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis
                    dataKey="range"
                    type="category"
                    fontSize={12}
                    width={60}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                            <p className="text-sm text-foreground">
                              <span className="font-semibold">{payload[0].payload.range}</span> below
                              market
                            </p>
                            <p className="text-sm text-primary">
                              {payload[0].value} properties
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {dropsByRange.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Property List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bento-card"
          >
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Market Value Opportunities
            </h3>
            {priceDrops.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                All properties are priced at or above market average
              </p>
            ) : (
              <div className="space-y-3">
                {priceDrops.slice(0, 10).map((property, idx) => (
                  <motion.div
                    key={property.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                  >
                    <Card className="p-4 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-foreground truncate">
                              {property.address}
                            </p>
                            {property.potentialOpportunity && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                <TrendingDown className="w-3 h-3 mr-1" />
                                High Value Potential
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {property.beds}bd / {property.baths}ba •{" "}
                            {property.sqft.toLocaleString()} sqft • {property.neighborhood}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              ${property.pricePerSqft}/sqft
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {property.dom} days
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-foreground">
                            {formatPrice(property.price)}
                          </p>
                          <Badge className="bg-primary/10 text-primary border-0">
                            {property.percentBelow}% below avg
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Save ~{formatPrice(property.estimatedSavings)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Link to={`/property/${property.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
      <ReportDisclaimer />
    </div>
  );
}
