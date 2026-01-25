import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { TrendingUp, Percent, DollarSign, Calendar } from "lucide-react";

interface CalculatorInputs {
  purchasePrice: number;
  downPayment: number;
  interestRate: number;
  closingCosts: number;
  monthlyRent: number;
}

interface InvestmentCalculatorProps {
  initialPrice?: number;
}

export function InvestmentCalculator({ initialPrice = 450000 }: InvestmentCalculatorProps) {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    purchasePrice: initialPrice,
    downPayment: 20,
    interestRate: 6.5,
    closingCosts: 3,
    monthlyRent: Math.round(initialPrice * 0.006), // ~0.6% of price as monthly rent estimate
  });

  // Update when initialPrice changes (from API)
  useEffect(() => {
    if (initialPrice && initialPrice !== inputs.purchasePrice) {
      setInputs((prev) => ({
        ...prev,
        purchasePrice: initialPrice,
        monthlyRent: Math.round(initialPrice * 0.006),
      }));
    }
  }, [initialPrice]);

  const calculations = useMemo(() => {
    const downPaymentAmount = (inputs.purchasePrice * inputs.downPayment) / 100;
    const loanAmount = inputs.purchasePrice - downPaymentAmount;
    const closingCostsAmount = (inputs.purchasePrice * inputs.closingCosts) / 100;
    const totalInvestment = downPaymentAmount + closingCostsAmount;

    // Monthly mortgage payment (30-year fixed)
    const monthlyRate = inputs.interestRate / 100 / 12;
    const numPayments = 30 * 12;
    const monthlyPayment = monthlyRate > 0
      ? (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount / numPayments;

    // Operating expenses (realistic estimates)
    // Property tax (~1.2% of value annually), insurance (~0.5%), maintenance (~1%), vacancy (~5% of rent)
    const annualPropertyTax = inputs.purchasePrice * 0.012;
    const annualInsurance = inputs.purchasePrice * 0.005;
    const annualMaintenance = inputs.purchasePrice * 0.01;
    const annualVacancy = inputs.monthlyRent * 12 * 0.05;
    const totalAnnualExpenses = annualPropertyTax + annualInsurance + annualMaintenance + annualVacancy;
    const monthlyExpenses = totalAnnualExpenses / 12;

    // Annual calculations
    const annualRent = inputs.monthlyRent * 12;
    const annualMortgage = monthlyPayment * 12;
    // Net Operating Income (NOI) = Rent - Operating Expenses (before mortgage)
    const noi = annualRent - totalAnnualExpenses;
    // Cash Flow = NOI - Mortgage
    const annualCashFlow = noi - annualMortgage;

    // Key metrics
    // Cash-on-Cash ROI = Annual Cash Flow / Total Cash Invested
    const roi = totalInvestment > 0 ? ((annualCashFlow / totalInvestment) * 100).toFixed(1) : '0.0';
    // Cap Rate = NOI / Purchase Price (ignores financing)
    const capRate = inputs.purchasePrice > 0 ? ((noi / inputs.purchasePrice) * 100).toFixed(1) : '0.0';
    // GRM = Price / Annual Rent
    const grm = annualRent > 0 ? (inputs.purchasePrice / annualRent).toFixed(1) : '0.0';

    // 10-year projection with realistic principal paydown
    const tenYearCashFlow = Array.from({ length: 10 }, (_, i) => {
      const year = i + 1;
      const rentGrowth = Math.pow(1.03, year); // 3% annual rent growth
      const expenseGrowth = Math.pow(1.02, year); // 2% expense growth
      const projectedRent = annualRent * rentGrowth;
      const projectedExpenses = totalAnnualExpenses * expenseGrowth;
      const projectedNOI = projectedRent - projectedExpenses;
      const projectedCashFlow = projectedNOI - annualMortgage;
      
      // Equity from principal paydown (simplified linear approximation)
      // In reality, early years have less principal paydown, but this is reasonable for estimates
      const principalPaid = loanAmount * (year / 30) * 0.6;
      
      return {
        year,
        cashFlow: projectedCashFlow,
        equity: downPaymentAmount + principalPaid,
      };
    });

    return {
      downPaymentAmount,
      loanAmount,
      closingCostsAmount,
      totalInvestment,
      monthlyPayment,
      monthlyExpenses,
      noi,
      annualCashFlow,
      roi,
      capRate,
      grm,
      tenYearCashFlow,
    };
  }, [inputs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Input Section */}
      <div className="bento-card">
        <h3 className="font-display text-lg font-semibold text-foreground mb-6">
          Investment Parameters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Purchase Price
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                value={inputs.purchasePrice}
                onChange={(e) =>
                  setInputs({ ...inputs, purchasePrice: Number(e.target.value) })
                }
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Down Payment: {inputs.downPayment}%
            </Label>
            <Slider
              value={[inputs.downPayment]}
              onValueChange={(v) => setInputs({ ...inputs, downPayment: v[0] })}
              max={50}
              min={5}
              step={1}
              className="py-2"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Interest Rate: {inputs.interestRate}%
            </Label>
            <Slider
              value={[inputs.interestRate]}
              onValueChange={(v) => setInputs({ ...inputs, interestRate: v[0] })}
              max={10}
              min={3}
              step={0.125}
              className="py-2"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Closing Costs: {inputs.closingCosts}%
            </Label>
            <Slider
              value={[inputs.closingCosts]}
              onValueChange={(v) => setInputs({ ...inputs, closingCosts: v[0] })}
              max={6}
              min={1}
              step={0.5}
              className="py-2"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Expected Monthly Rent
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                value={inputs.monthlyRent}
                onChange={(e) =>
                  setInputs({ ...inputs, monthlyRent: Number(e.target.value) })
                }
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Output Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <TrendingUp className="w-4 h-4" />
            ROI
          </div>
          <p className="text-2xl font-display font-bold text-primary">
            {calculations.roi}%
          </p>
        </Card>
        <Card className="p-4 bg-accent/5 border-accent/20">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <Percent className="w-4 h-4" />
            Cap Rate
          </div>
          <p className="text-2xl font-display font-bold text-accent">
            {calculations.capRate}%
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <Calendar className="w-4 h-4" />
            GRM
          </div>
          <p className="text-2xl font-display font-bold text-foreground">
            {calculations.grm}x
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <DollarSign className="w-4 h-4" />
            Monthly Payment
          </div>
          <p className="text-2xl font-display font-bold text-foreground">
            ${calculations.monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </Card>
      </div>

      {/* Cash Flow Projection */}
      <div className="bento-card">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">
          10-Year Cash Flow Projection
        </h3>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
          {calculations.tenYearCashFlow.map((year) => (
            <div
              key={year.year}
              className="text-center p-3 rounded-lg bg-secondary/50"
            >
              <p className="text-xs text-muted-foreground mb-1">Y{year.year}</p>
              <p
                className={`text-sm font-semibold ${
                  year.cashFlow > 0 ? "text-primary" : "text-destructive"
                }`}
              >
                ${(year.cashFlow / 1000).toFixed(1)}k
              </p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
