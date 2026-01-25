import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Home,
  Hammer,
  Loader2,
  Percent,
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
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
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

export default function SoldAnalytics() {
  const { properties, loading, refetch, lastUpdated } = useProperties({ 
    top: 2000,
    filter: "StandardStatus eq 'Closed'",
    skipCache: true
  });
  const [selectedTown, setSelectedTown] = useState("All Towns");
  const [timeRange, setTimeRange] = useState("6months");

  // Filter by date range
  const filteredByTime = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    
    switch (timeRange) {
      case "3months":
        cutoff.setMonth(now.getMonth() - 3);
        break;
      case "6months":
        cutoff.setMonth(now.getMonth() - 6);
        break;
      case "12months":
        cutoff.setFullYear(now.getFullYear() - 1);
        break;
      default:
        cutoff.setMonth(now.getMonth() - 6);
    }
    
    return properties.filter(p => {
      // Use closeDate for sold properties, fallback to offMarketDate or listDate
      const dateStr = p.closeDate || p.offMarketDate || p.listDate;
      if (!dateStr) return false; // Skip if no date
      const closeDate = new Date(dateStr);
      return closeDate >= cutoff && !isNaN(closeDate.getTime());
    });
  }, [properties, timeRange]);

  // Filter by town
  const filteredProperties = useMemo(() => {
    if (selectedTown === "All Towns") return filteredByTime;
    return filteredByTime.filter(p => p.neighborhood === selectedTown || p.address.includes(selectedTown));
  }, [filteredByTime, selectedTown]);

  // Sale-to-List Ratio (using closePrice for sold properties)
  const saleToListStats = useMemo(() => {
    const propsWithData = filteredProperties.filter(p => 
      p.originalPrice && p.originalPrice > 0 && (p.closePrice || p.price)
    );
    
    const ratios = propsWithData.map(p => {
      const salePrice = p.closePrice || p.price;
      return Math.min((salePrice / p.originalPrice) * 100, 150); // Cap at 150% to avoid outliers
    });
    
    if (ratios.length === 0) return { avg: 100, overAsk: 0, underAsk: 0, atAsk: 0 };

    const avg = Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length * 10) / 10;
    const overAsk = Math.round((ratios.filter(r => r > 100).length / ratios.length) * 100);
    const underAsk = Math.round((ratios.filter(r => r < 97).length / ratios.length) * 100);
    const atAsk = 100 - overAsk - underAsk;

    return { avg, overAsk, underAsk, atAsk };
  }, [filteredProperties]);

  // DOM Cost Analysis - "Every X days costs sellers $Y"
  const domCostAnalysis = useMemo(() => {
    const domRanges = [
      { label: "0-14 days", min: 0, max: 14 },
      { label: "15-30 days", min: 15, max: 30 },
      { label: "31-60 days", min: 31, max: 60 },
      { label: "61-90 days", min: 61, max: 90 },
      { label: "90+ days", min: 91, max: 9999 },
    ];

    const data = domRanges.map((range, idx) => {
      const props = filteredProperties.filter(p => p.dom >= range.min && p.dom <= range.max);
      const avgSaleToList = props.length > 0
        ? Math.round(props.reduce((a, p) => {
            const salePrice = p.closePrice || p.price;
            return a + (salePrice / (p.originalPrice || salePrice)) * 100;
          }, 0) / props.length * 10) / 10
        : 100;
      
      return {
        range: range.label,
        avgSaleToList,
        count: props.length,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      };
    }).filter(d => d.count > 0);

    // Calculate cost per 10 days - more conservative approach
    const quickSales = filteredProperties.filter(p => p.dom <= 14 && p.originalPrice);
    const slowSales = filteredProperties.filter(p => p.dom > 60 && p.originalPrice);
    
    let costPer10Days = 0;
    if (quickSales.length >= 5 && slowSales.length >= 5) {
      const quickAvgRatio = quickSales.reduce((a, p) => {
        const salePrice = p.closePrice || p.price;
        return a + (salePrice / p.originalPrice);
      }, 0) / quickSales.length;
      
      const slowAvgRatio = slowSales.reduce((a, p) => {
        const salePrice = p.closePrice || p.price;
        return a + (salePrice / p.originalPrice);
      }, 0) / slowSales.length;
      
      const propsWithOriginalPrice = filteredProperties.filter(p => p.originalPrice && p.originalPrice > 0);
      const avgOriginalPrice = propsWithOriginalPrice.length > 0
        ? propsWithOriginalPrice.reduce((a, p) => a + p.originalPrice, 0) / propsWithOriginalPrice.length
        : 0;
      
      // Cost per 10 days = difference in ratio * average price / (average DOM difference / 10)
      const avgDOMDiff = (slowSales.reduce((a, p) => a + p.dom, 0) / slowSales.length) - 
                        (quickSales.reduce((a, p) => a + p.dom, 0) / quickSales.length);
      
      if (avgDOMDiff > 0 && avgOriginalPrice > 0) {
        costPer10Days = Math.round(((quickAvgRatio - slowAvgRatio) * avgOriginalPrice) / (avgDOMDiff / 10));
      }
    }

    return { data, costPer10Days };
  }, [filteredProperties]);

  // Price/Sqft Trends (using closePrice for sold properties)
  const pricePerSqftStats = useMemo(() => {
    const propsWithSqft = filteredProperties.filter(p => p.sqft && p.sqft > 0 && (p.closePrice || p.price));
    
    if (propsWithSqft.length === 0) return { avg: 0, trend: [] };

    const avg = Math.round(propsWithSqft.reduce((a, p) => {
      const salePrice = p.closePrice || p.price;
      return a + (salePrice / p.sqft);
    }, 0) / propsWithSqft.length);

    // Group by month for trend (use closeDate for sold properties)
    const byMonth: Record<string, { total: number; count: number }> = {};
    propsWithSqft.forEach(p => {
      const dateStr = p.closeDate || p.offMarketDate || p.listDate;
      if (!dateStr) return;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[monthKey]) byMonth[monthKey] = { total: 0, count: 0 };
      const salePrice = p.closePrice || p.price;
      byMonth[monthKey].total += salePrice / p.sqft;
      byMonth[monthKey].count++;
    });

    const trend = Object.entries(byMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        pricePerSqft: Math.round(data.total / data.count),
      }))
      .slice(-6); // Last 6 months

    return { avg, trend };
  }, [filteredProperties]);

  // New Construction vs Resale (using closePrice)
  const newVsResale = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const newConstruction = filteredProperties.filter(p => p.yearBuilt && p.yearBuilt >= currentYear - 1);
    const resale = filteredProperties.filter(p => !p.yearBuilt || p.yearBuilt < currentYear - 1);

    const newAvgPrice = newConstruction.length > 0 
      ? Math.round(newConstruction.reduce((a, p) => a + (p.closePrice || p.price), 0) / newConstruction.length)
      : 0;
    const resaleAvgPrice = resale.length > 0 
      ? Math.round(resale.reduce((a, p) => a + (p.closePrice || p.price), 0) / resale.length)
      : 0;

    const newAvgDOM = newConstruction.length > 0 
      ? Math.round(newConstruction.reduce((a, p) => a + p.dom, 0) / newConstruction.length)
      : 0;
    const resaleAvgDOM = resale.length > 0 
      ? Math.round(resale.reduce((a, p) => a + p.dom, 0) / resale.length)
      : 0;

    return {
      newConstruction: { count: newConstruction.length, avgPrice: newAvgPrice, avgDOM: newAvgDOM },
      resale: { count: resale.length, avgPrice: resaleAvgPrice, avgDOM: resaleAvgDOM },
    };
  }, [filteredProperties]);

  // Town Breakdown (using closePrice)
  const townBreakdown = useMemo(() => {
    const townStats: Record<string, any> = {};

    TOWNS.slice(1).forEach(town => {
      const townProps = filteredByTime.filter(p => {
        // More robust town matching
        const addressTown = p.address.split(',').pop()?.trim().split(' ')[0] || '';
        return p.neighborhood === town || 
               addressTown.toLowerCase() === town.toLowerCase() ||
               p.address.toLowerCase().includes(town.toLowerCase());
      });

      if (townProps.length > 0) {
        const propsWithData = townProps.filter(p => p.originalPrice && (p.closePrice || p.price));
        
        const avgSaleToList = propsWithData.length > 0 ? Math.round(
          propsWithData.reduce((a, p) => {
            const salePrice = p.closePrice || p.price;
            return a + (salePrice / p.originalPrice) * 100;
          }, 0) / propsWithData.length * 10
        ) / 10 : 100;
        
        const propsWithSqft = townProps.filter(p => p.sqft && p.sqft > 0 && (p.closePrice || p.price));
        const avgPricePerSqft = propsWithSqft.length > 0
          ? Math.round(propsWithSqft.reduce((a, p) => {
              const salePrice = p.closePrice || p.price;
              return a + (salePrice / p.sqft);
            }, 0) / propsWithSqft.length)
          : 0;

        const avgSalePrice = townProps.length > 0
          ? Math.round(townProps.reduce((a, p) => a + (p.closePrice || p.price), 0) / townProps.length)
          : 0;

        townStats[town] = {
          count: townProps.length,
          avgSaleToList,
          avgPricePerSqft,
          avgPrice: avgSalePrice,
          medianDOM: Math.round(townProps.reduce((a, p) => a + p.dom, 0) / townProps.length),
          strength: avgSaleToList >= 100 ? "Seller's Market" : 
                   avgSaleToList >= 97 ? "Balanced" : "Buyer's Market",
        };
      }
    });

    return Object.entries(townStats)
      .map(([town, stats], idx) => ({
        town,
        ...stats,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }))
      .sort((a, b) => b.avgSaleToList - a.avgSaleToList);
  }, [filteredByTime]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading sold properties...</span>
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
              Sold Analytics
            </h1>
            <p className="text-muted-foreground">
              Sale-to-list ratios, DOM impact & pricing trends for {filteredProperties.length} closed sales
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">3 Months</SelectItem>
                <SelectItem value="6months">6 Months</SelectItem>
                <SelectItem value="12months">12 Months</SelectItem>
              </SelectContent>
            </Select>
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
              <Percent className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Avg Sale-to-List</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{saleToListStats.avg}%</p>
          <div className="flex gap-2 mt-2">
            <Badge variant={saleToListStats.overAsk > 30 ? "default" : "secondary"} className="text-xs">
              {saleToListStats.overAsk}% over ask
            </Badge>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Clock className="w-5 h-5 text-red-500" />
            </div>
            <span className="text-sm text-muted-foreground">DOM Cost Impact</span>
          </div>
          <p className="text-3xl font-bold text-foreground">
            ${Math.abs(domCostAnalysis.costPer10Days).toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Cost per 10 days on market
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-500/10">
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-sm text-muted-foreground">Avg Price/Sqft</span>
          </div>
          <p className="text-3xl font-bold text-foreground">${pricePerSqftStats.avg}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Market rate
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Hammer className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm text-muted-foreground">New Construction</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{newVsResale.newConstruction.count}</p>
          <p className="text-sm text-muted-foreground mt-1">
            vs {newVsResale.resale.count} resale
          </p>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sale-to-List by DOM */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-primary" />
            Sale-to-List % by Days on Market
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Longer DOM = lower sale price relative to list
          </p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domCostAnalysis.data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis domain={[90, 105]} tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgSaleToList" name="Avg Sale-to-List %" radius={[4, 4, 0, 0]}>
                  {domCostAnalysis.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Price/Sqft Trend */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Price per Sqft Trend
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Rolling monthly average
          </p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pricePerSqftStats.trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="pricePerSqft" 
                  name="$/Sqft" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* New Construction vs Resale Comparison */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Hammer className="w-5 h-5 text-primary" />
          New Construction vs Resale Comparison
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Hammer className="w-4 h-4 text-amber-500" />
              New Construction (Built {new Date().getFullYear() - 1}+)
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Count</span>
                <span className="font-medium">{newVsResale.newConstruction.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Price</span>
                <span className="font-medium">${(newVsResale.newConstruction.avgPrice / 1000000).toFixed(2)}M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg DOM</span>
                <span className="font-medium">{newVsResale.newConstruction.avgDOM} days</span>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Home className="w-4 h-4 text-blue-500" />
              Resale Properties
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Count</span>
                <span className="font-medium">{newVsResale.resale.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Price</span>
                <span className="font-medium">${(newVsResale.resale.avgPrice / 1000000).toFixed(2)}M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg DOM</span>
                <span className="font-medium">{newVsResale.resale.avgDOM} days</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Town Comparison Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Town-by-Town Sale Analytics
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Town</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Sales</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Sale-to-List</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">$/Sqft</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Avg Price</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Strength</th>
              </tr>
            </thead>
            <tbody>
              {townBreakdown.map((town) => (
                <tr key={town.town} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="py-3 px-4 font-medium text-foreground">{town.town}</td>
                  <td className="py-3 px-4 text-right text-foreground">{town.count}</td>
                  <td className="py-3 px-4 text-right text-foreground">
                    <span className={town.avgSaleToList > 100 ? "text-green-500" : "text-red-500"}>
                      {town.avgSaleToList}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-foreground">${town.avgPricePerSqft}</td>
                  <td className="py-3 px-4 text-right text-foreground">
                    ${(town.avgPrice / 1000000).toFixed(2)}M
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Badge 
                      variant={town.strength === "Seller's Market" ? "default" : town.strength === "Balanced" ? "secondary" : "outline"}
                      className={town.strength === "Seller's Market" ? "bg-green-500" : ""}
                    >
                      {town.strength}
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
        <Card className="p-6 bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-500" />
            Seller Insight: DOM Costs Money
          </h4>
          <p className="text-sm text-muted-foreground">
            Every 10 days on market costs sellers approximately <strong>${Math.abs(domCostAnalysis.costPer10Days).toLocaleString()}</strong> in reduced sale price.
            Price correctly from day 1.
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Market Strength
          </h4>
          <p className="text-sm text-muted-foreground">
            {saleToListStats.overAsk}% of homes sold over asking price.
            Average sale-to-list is {saleToListStats.avg}% — 
            {saleToListStats.avg > 100 ? " indicating strong demand." : " a balanced market."}
          </p>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Hammer className="w-4 h-4 text-amber-500" />
            New Construction Premium
          </h4>
          <p className="text-sm text-muted-foreground">
            New construction averages ${(newVsResale.newConstruction.avgPrice / 1000000).toFixed(2)}M 
            vs resale at ${(newVsResale.resale.avgPrice / 1000000).toFixed(2)}M
            {newVsResale.newConstruction.avgPrice > newVsResale.resale.avgPrice 
              ? ` — a ${Math.round((newVsResale.newConstruction.avgPrice / newVsResale.resale.avgPrice - 1) * 100)}% premium.`
              : "."}
          </p>
        </Card>
      </div>
    </div>
  );
}
