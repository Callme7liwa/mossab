import { useMemo } from "react";
import { motion } from "framer-motion";
import { InvestmentCalculator } from "@/components/calculator/InvestmentCalculator";
import { LastUpdated } from "@/components/dashboard/LastUpdated";
import { useProperties } from "@/hooks/useProperties";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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
            <span className="text-muted-foreground capitalize">{entry.dataKey}:</span>
            <span className="font-medium text-foreground">
              ${entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function FinancialForecaster() {
  // Use Active listings for current market stats
  const { stats, loading, refetch, lastUpdated } = useProperties({ 
    top: 500,
    filter: "StandardStatus eq 'Active'"
  });

  // Generate equity projection based on median price from API
  const equityData = useMemo(() => {
    const medianPrice = stats.medianPrice || 450000;
    const downPayment = medianPrice * 0.2; // 20% down
    const loanAmount = medianPrice - downPayment;
    const appreciationRate = 0.04; // 4% annual appreciation
    const interestRate = 0.065; // 6.5% mortgage rate
    const monthlyRate = interestRate / 12;

    return Array.from({ length: 10 }, (_, i) => {
      const year = i + 1;
      // More accurate principal paydown calculation
      // After n years of payments, remaining balance = original * [(1+r)^N - (1+r)^n] / [(1+r)^N - 1]
      const totalPayments = 30 * 12;
      const paymentsMade = year * 12;
      const factor = Math.pow(1 + monthlyRate, totalPayments);
      const factorN = Math.pow(1 + monthlyRate, paymentsMade);
      const remainingBalance = loanAmount * (factor - factorN) / (factor - 1);
      const principalPaid = loanAmount - remainingBalance;
      const equity = Math.round(downPayment + principalPaid);
      
      // Appreciation on property value
      const appreciation = Math.round(medianPrice * (Math.pow(1 + appreciationRate, year) - 1));
      return {
        year: `Y${year}`,
        equity,
        appreciation,
      };
    });
  }, [stats.medianPrice]);

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
              Financial Forecaster
            </h1>
            <p className="text-muted-foreground">
              Model investment scenarios based on ${stats.medianPrice.toLocaleString()} median price
            </p>
          </div>
          <LastUpdated timestamp={lastUpdated} loading={loading} onRefresh={refetch} />
        </div>
      </motion.div>

      {/* Calculator */}
      <InvestmentCalculator initialPrice={stats.medianPrice || 450000} />

      {/* Equity Growth Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="bento-card"
      >
        <div className="mb-6">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Equity Growth Projection
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Principal paydown and appreciation over 10 years
          </p>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={equityData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--chart-1))"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--chart-1))"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="colorAppreciation" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--chart-2))"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--chart-2))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.5}
              />
              <XAxis
                dataKey="year"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorEquity)"
              />
              <Area
                type="monotone"
                dataKey="appreciation"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAppreciation)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
