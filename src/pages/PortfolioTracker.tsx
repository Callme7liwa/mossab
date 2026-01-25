import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  TrendingUp,
  DollarSign,
  Percent,
  Building2,
  Loader2,
  Edit2,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LastUpdated } from "@/components/dashboard/LastUpdated";
import { useProperties } from "@/hooks/useProperties";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface PortfolioProperty {
  id: string;
  address: string;
  purchasePrice: number;
  purchaseDate: string;
  currentValue: number;
  monthlyRent: number;
  monthlyExpenses: number;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

// Portfolio data is managed locally - in production would be stored in database
const INITIAL_PORTFOLIO: PortfolioProperty[] = [];

export default function PortfolioTracker() {
  // Use Active listings for current market stats comparison
  const { stats, loading, refetch, lastUpdated } = useProperties({ 
    top: 500,
    filter: "StandardStatus eq 'Active'"
  });
  const [portfolio, setPortfolio] = useState<PortfolioProperty[]>(INITIAL_PORTFOLIO);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProperty, setNewProperty] = useState({
    address: "",
    purchasePrice: "",
    purchaseDate: "",
    currentValue: "",
    monthlyRent: "",
    monthlyExpenses: "",
  });

  const portfolioStats = useMemo(() => {
    if (portfolio.length === 0) {
      return {
        totalValue: 0,
        totalEquity: 0,
        totalCashFlow: 0,
        avgROI: 0,
        appreciation: 0,
      };
    }

    const totalPurchase = portfolio.reduce((sum, p) => sum + p.purchasePrice, 0);
    const totalValue = portfolio.reduce((sum, p) => sum + p.currentValue, 0);
    // Equity = Current Value - Loan Balance (assuming 20% down, loan balance = 80% of purchase)
    const totalLoanBalance = totalPurchase * 0.8;
    const totalEquity = totalValue - totalLoanBalance;
    const monthlyCashFlow = portfolio.reduce(
      (sum, p) => sum + (p.monthlyRent - p.monthlyExpenses),
      0
    );
    const annualCashFlow = monthlyCashFlow * 12;
    const totalDownPayment = totalPurchase * 0.2;
    const avgROI = totalDownPayment > 0 ? (annualCashFlow / totalDownPayment) * 100 : 0;
    const appreciation = totalPurchase > 0 ? ((totalValue - totalPurchase) / totalPurchase) * 100 : 0;

    return {
      totalValue,
      totalEquity,
      totalCashFlow: monthlyCashFlow,
      avgROI,
      appreciation,
    };
  }, [portfolio]);

  const allocationData = useMemo(() => {
    return portfolio.map((p, idx) => ({
      name: p.address.length > 20 ? p.address.slice(0, 17) + "..." : p.address,
      value: p.currentValue,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [portfolio]);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
    if (price >= 1000) return `$${Math.round(price / 1000)}K`;
    return `$${price}`;
  };

  const handleAddProperty = () => {
    // Validation
    if (!newProperty.address.trim()) {
      alert('Please enter a property address');
      return;
    }
    if (!newProperty.purchasePrice || Number(newProperty.purchasePrice) <= 0) {
      alert('Please enter a valid purchase price');
      return;
    }
    if (!newProperty.purchaseDate) {
      alert('Please select a purchase date');
      return;
    }
    if (!newProperty.monthlyRent || Number(newProperty.monthlyRent) <= 0) {
      alert('Please enter a valid monthly rent');
      return;
    }
    if (!newProperty.monthlyExpenses || Number(newProperty.monthlyExpenses) < 0) {
      alert('Please enter valid monthly expenses');
      return;
    }

    const property: PortfolioProperty = {
      id: Date.now().toString(),
      address: newProperty.address,
      purchasePrice: Number(newProperty.purchasePrice),
      purchaseDate: newProperty.purchaseDate,
      currentValue: Number(newProperty.currentValue) || Number(newProperty.purchasePrice),
      monthlyRent: Number(newProperty.monthlyRent),
      monthlyExpenses: Number(newProperty.monthlyExpenses),
    };
    setPortfolio([...portfolio, property]);
    setNewProperty({
      address: "",
      purchasePrice: "",
      purchaseDate: "",
      currentValue: "",
      monthlyRent: "",
      monthlyExpenses: "",
    });
    setIsAddOpen(false);
  };

  const handleRemoveProperty = (id: string) => {
    setPortfolio(portfolio.filter((p) => p.id !== id));
  };

  const updateCurrentValues = () => {
    // Simulate updating values based on market appreciation
    const appreciationRate = 1 + (stats.medianPrice > 400000 ? 0.05 : 0.03);
    setPortfolio(
      portfolio.map((p) => ({
        ...p,
        currentValue: Math.round(p.purchasePrice * appreciationRate),
      }))
    );
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
              Portfolio Tracker
            </h1>
            <p className="text-muted-foreground">
              Track and analyze your investment properties
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LastUpdated timestamp={lastUpdated} loading={loading} onRefresh={refetch} />
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Property
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Investment Property</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Property Address</Label>
                    <Input
                      value={newProperty.address}
                      onChange={(e) =>
                        setNewProperty({ ...newProperty, address: e.target.value })
                      }
                      placeholder="123 Main Street"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Purchase Price</Label>
                      <Input
                        type="number"
                        value={newProperty.purchasePrice}
                        onChange={(e) =>
                          setNewProperty({ ...newProperty, purchasePrice: e.target.value })
                        }
                        placeholder="350000"
                      />
                    </div>
                    <div>
                      <Label>Purchase Date</Label>
                      <Input
                        type="date"
                        value={newProperty.purchaseDate}
                        onChange={(e) =>
                          setNewProperty({ ...newProperty, purchaseDate: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Monthly Rent</Label>
                      <Input
                        type="number"
                        value={newProperty.monthlyRent}
                        onChange={(e) =>
                          setNewProperty({ ...newProperty, monthlyRent: e.target.value })
                        }
                        placeholder="2400"
                      />
                    </div>
                    <div>
                      <Label>Monthly Expenses</Label>
                      <Input
                        type="number"
                        value={newProperty.monthlyExpenses}
                        onChange={(e) =>
                          setNewProperty({ ...newProperty, monthlyExpenses: e.target.value })
                        }
                        placeholder="1800"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Current Value (optional)</Label>
                    <Input
                      type="number"
                      value={newProperty.currentValue}
                      onChange={(e) =>
                        setNewProperty({ ...newProperty, currentValue: e.target.value })
                      }
                      placeholder="Leave blank to use purchase price"
                    />
                  </div>
                  <Button className="w-full" onClick={handleAddProperty}>
                    Add to Portfolio
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>

      {/* Metrics Explanation */}
      {portfolio.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Understanding Your Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800 dark:text-blue-200">
              <div>
                <strong>ROI (Return on Investment):</strong> Annual cash flow divided by your down payment investment
              </div>
              <div>
                <strong>Cap Rate:</strong> Annual rental income divided by current property value
              </div>
              <div>
                <strong>Cash Flow:</strong> Monthly rent minus monthly expenses (includes mortgage, taxes, insurance, maintenance)
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bento-card"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{portfolio.length}</p>
              <p className="text-sm text-muted-foreground">Properties</p>
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
              <p className="text-2xl font-bold text-foreground">
                {formatPrice(portfolioStats.totalValue)}
              </p>
              <p className="text-sm text-muted-foreground">Total Value</p>
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
              <TrendingUp className="w-5 h-5 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatPrice(portfolioStats.totalEquity)}
              </p>
              <p className="text-sm text-muted-foreground">Est. Equity</p>
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
              <DollarSign className="w-5 h-5 text-chart-3" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatPrice(portfolioStats.totalCashFlow)}
              </p>
              <p className="text-sm text-muted-foreground">Monthly Cash Flow</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bento-card"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-chart-4/10">
              <Percent className="w-5 h-5 text-chart-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {portfolioStats.avgROI.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">Cash-on-Cash ROI</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts & Properties */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Allocation Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bento-card"
        >
          <h3 className="font-display text-lg font-semibold text-foreground mb-4">
            Portfolio Allocation
          </h3>
          {portfolio.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Add properties to see allocation
            </div>
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold text-foreground">
                              {payload[0].name}
                            </p>
                            <p className="text-sm text-primary">
                              {formatPrice(payload[0].value as number)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* Property List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bento-card lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold text-foreground">
              Your Properties
            </h3>
            <Button variant="outline" size="sm" onClick={updateCurrentValues}>
              <TrendingUp className="w-4 h-4 mr-2" />
              Update Values
            </Button>
          </div>
          {portfolio.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No properties in your portfolio yet</p>
              <p className="text-sm">Click "Add Property" to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {portfolio.map((property, idx) => {
                const appreciation = property.purchasePrice > 0
                  ? ((property.currentValue - property.purchasePrice) /
                    property.purchasePrice) *
                  100
                  : 0;
                const monthlyCashFlow = property.monthlyRent - property.monthlyExpenses;
                const annualCashFlow = monthlyCashFlow * 12;
                const downPayment = property.purchasePrice * 0.2;
                const roi = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;
                const capRate = property.currentValue > 0
                  ? ((property.monthlyRent * 12) / property.currentValue) * 100
                  : 0;

                return (
                  <Card key={property.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground">{property.address}</p>
                          <Badge
                            variant={appreciation >= 0 ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {appreciation >= 0 ? "+" : ""}
                            {appreciation.toFixed(1)}%
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Purchased: {new Date(property.purchaseDate).toLocaleDateString()}{" "}
                          for {formatPrice(property.purchasePrice)}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-muted-foreground">
                            Rent:{" "}
                            <span className="text-foreground font-medium">
                              ${property.monthlyRent}/mo
                            </span>
                          </span>
                          <span className="text-muted-foreground">
                            Cash Flow:{" "}
                            <span
                              className={
                                monthlyCashFlow >= 0 ? "text-primary" : "text-destructive"
                              }
                            >
                              ${monthlyCashFlow}/mo
                            </span>
                          </span>
                          <span className="text-muted-foreground">
                            Cap Rate:{" "}
                            <span className="text-foreground font-medium">
                              {capRate.toFixed(1)}%
                            </span>
                          </span>
                          <span className="text-muted-foreground">
                            ROI:{" "}
                            <span className="text-foreground font-medium">
                              {roi.toFixed(1)}%
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">
                          {formatPrice(property.currentValue)}
                        </p>
                        <p className="text-xs text-muted-foreground">Current Value</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveProperty(property.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Market Context */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bento-card"
      >
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">
          Market Context
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Market Median Price</p>
            <p className="text-lg font-bold text-foreground">
              {loading ? "..." : formatPrice(stats.medianPrice)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Your Avg Purchase</p>
            <p className="text-lg font-bold text-foreground">
              {portfolio.length > 0
                ? formatPrice(
                    portfolio.reduce((s, p) => s + p.purchasePrice, 0) / portfolio.length
                  )
                : "$0"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Appreciation</p>
            <p className="text-lg font-bold text-primary">
              +{portfolioStats.appreciation.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Annual Cash Flow</p>
            <p className="text-lg font-bold text-foreground">
              {formatPrice(portfolioStats.totalCashFlow * 12)}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
