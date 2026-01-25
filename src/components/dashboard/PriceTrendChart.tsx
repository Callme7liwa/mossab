import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { Loader2 } from "lucide-react";
import { useProperties } from "@/hooks/useProperties";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.payload.range}:</span>
            <span className="font-medium text-foreground">
              {entry.value} properties
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const PRICE_RANGES = [
  { label: "Under $200k", min: 0, max: 200000, color: "hsl(var(--chart-3))" },
  { label: "$200k-$400k", min: 200000, max: 400000, color: "hsl(var(--chart-4))" },
  { label: "$400k-$600k", min: 400000, max: 600000, color: "hsl(var(--chart-1))" },
  { label: "$600k-$800k", min: 600000, max: 800000, color: "hsl(var(--chart-2))" },
  { label: "$800k-$1M", min: 800000, max: 1000000, color: "hsl(var(--chart-5))" },
  { label: "Over $1M", min: 1000000, max: Infinity, color: "hsl(var(--primary))" },
];

export function PriceTrendChart() {
  const { properties, loading } = useProperties({ top: 200 });

  // Calculate price distribution from live data
  const priceData = useMemo(() => {
    if (properties.length === 0) return [];

    return PRICE_RANGES.map((range) => {
      const count = properties.filter(
        (p) => p.price >= range.min && p.price < range.max
      ).length;
      return {
        name: range.label,
        range: range.label,
        count,
        color: range.color,
      };
    }).filter((d) => d.count > 0); // Only show ranges with properties
  }, [properties]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bento-card col-span-2"
    >
      <div className="mb-6">
        <h3 className="font-display text-lg font-semibold text-foreground">
          Price Distribution
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Current listings by price range
        </p>
      </div>
      <div className="h-[300px]">
        {loading && priceData.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={priceData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
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
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {priceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
