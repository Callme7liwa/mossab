import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  FileText,
  Download,
  Loader2,
  TrendingUp,
  Home,
  DollarSign,
  Clock,
  MapPin,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LastUpdated } from "@/components/dashboard/LastUpdated";
import { useProperties } from "@/hooks/useProperties";

export default function ReportGenerator() {
  const { properties, stats, loading, refetch, lastUpdated } = useProperties({ top: 200 });
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const reportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const neighborhoodStats = useMemo(() => {
    if (properties.length === 0) return [];

    const grouped: Record<string, typeof properties> = {};
    properties.forEach((p) => {
      const area = p.neighborhood || "Unknown";
      if (!grouped[area]) grouped[area] = [];
      grouped[area].push(p);
    });

    return Object.entries(grouped)
      .filter(([name]) => name !== "Unknown")
      .filter(([_, props]) => props.length > 0) // Guard against empty arrays
      .map(([name, props]) => ({
        name,
        count: props.length,
        avgPrice: Math.round(props.reduce((a, p) => a + p.price, 0) / props.length),
        avgDOM: Math.round(props.reduce((a, p) => a + p.dom, 0) / props.length),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [properties]);

  const priceDistribution = useMemo(() => {
    if (properties.length === 0) return [];

    const ranges = [
      { label: "Under $300K", min: 0, max: 300000 },
      { label: "$300K - $500K", min: 300000, max: 500000 },
      { label: "$500K - $750K", min: 500000, max: 750000 },
      { label: "$750K - $1M", min: 750000, max: 1000000 },
      { label: "Over $1M", min: 1000000, max: Infinity },
    ];

    return ranges.map((range) => ({
      label: range.label,
      count: properties.filter((p) => p.price >= range.min && p.price < range.max).length,
    }));
  }, [properties]);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(2)}M`;
    if (price >= 1000) return `$${Math.round(price / 1000)}K`;
    return `$${price}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      // Create canvas from the report element
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      // Download the PDF
      const fileName = `market-report-${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCSV = () => {
    try {
      // Enhanced CSV with all available data
      const headers = [
        "Address",
        "Neighborhood", 
        "Property Type",
        "Listing Price",
        "Square Feet",
        "Price per SqFt",
        "Bedrooms",
        "Bathrooms", 
        "Days on Market",
        "Year Built",
        "Status",
        "Photos Count"
      ];
      
      const rows = properties.map((p) => [
        `"${p.address}"`,
        `"${p.neighborhood || 'N/A'}"`,
        `"${p.type || 'N/A'}"`,
        p.price || 0,
        p.sqft || 0,
        p.pricePerSqft || 0,
        p.beds || 0,
        p.baths || 0,
        p.dom || 0,
        p.yearBuilt || 'N/A',
        `"${p.status || 'N/A'}"`,
        p.photosCount || 0
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `property-data-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error generating CSV:', error);
      alert('Error generating CSV. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header - Hidden in print */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 print:hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              Report Generator
            </h1>
            <p className="text-muted-foreground">
              Generate and export professional market reports
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LastUpdated timestamp={lastUpdated} loading={loading} onRefresh={refetch} />
          </div>
        </div>
      </motion.div>

      {/* Actions Bar - Hidden in print */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap gap-3 print:hidden"
      >
        <Button onClick={handlePrint} disabled={loading || isExporting}>
          <FileText className="w-4 h-4 mr-2" />
          Print Report
        </Button>
        <Button onClick={handleDownloadPDF} disabled={loading || isExporting}>
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          {isExporting ? "Generating PDF..." : "Download PDF"}
        </Button>
        <Button variant="outline" onClick={handleDownloadCSV} disabled={loading || isExporting}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV Data
        </Button>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center h-96 print:hidden">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        /* Report Content - This gets printed */
        <div ref={reportRef} className="print:p-0">
          {/* Report Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bento-card mb-6 print:border-0 print:shadow-none print:p-0"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Market Analysis Report
                </h2>
                <p className="text-muted-foreground">Generated: {reportDate}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  <span className="font-display font-bold text-lg text-foreground">
                    Aura Estates
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Intelligence Platform</p>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4 print:border print:border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Median Price</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {formatPrice(stats.medianPrice)}
                </p>
              </Card>
              <Card className="p-4 print:border print:border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Home className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Active Listings</span>
                </div>
                <p className="text-xl font-bold text-foreground">{stats.totalInventory}</p>
              </Card>
              <Card className="p-4 print:border print:border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Avg Days on Market</span>
                </div>
                <p className="text-xl font-bold text-foreground">{stats.avgDaysOnMarket}</p>
              </Card>
              <Card className="p-4 print:border print:border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Avg $/Sq Ft</span>
                </div>
                <p className="text-xl font-bold text-foreground">${stats.avgPricePerSqft}</p>
              </Card>
            </div>
          </motion.div>

          {/* Price Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bento-card mb-6 print:border print:border-gray-200 print:shadow-none"
          >
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Price Distribution
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {priceDistribution.map((range) => (
                <div key={range.label} className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{range.count}</p>
                  <p className="text-xs text-muted-foreground">{range.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Neighborhood Analysis */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bento-card mb-6 print:border print:border-gray-200 print:shadow-none"
          >
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Top Neighborhoods
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted-foreground">
                    Neighborhood
                  </th>
                  <th className="text-right py-2 font-medium text-muted-foreground">
                    Listings
                  </th>
                  <th className="text-right py-2 font-medium text-muted-foreground">
                    Avg Price
                  </th>
                  <th className="text-right py-2 font-medium text-muted-foreground">
                    Avg DOM
                  </th>
                </tr>
              </thead>
              <tbody>
                {neighborhoodStats.map((n) => (
                  <tr key={n.name} className="border-b border-border/50">
                    <td className="py-2 font-medium text-foreground">{n.name}</td>
                    <td className="py-2 text-right text-foreground">{n.count}</td>
                    <td className="py-2 text-right text-foreground">
                      {formatPrice(n.avgPrice)}
                    </td>
                    <td className="py-2 text-right text-foreground">{n.avgDOM} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* Property Listings Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bento-card print:border print:border-gray-200 print:shadow-none"
          >
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Property Listings Sample ({properties.length} total available)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Address</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Price</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Sqft</th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">Bed/Bath</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">$/Sqft</th>
                    <th className="text-center py-2 px-2 font-medium text-muted-foreground">DOM</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.slice(0, 15).map((property, idx) => (
                    <tr key={property.id} className="border-b border-border/30">
                      <td className="py-2 px-2 font-medium text-foreground">
                        {property.address.length > 30 ? property.address.slice(0, 30) + '...' : property.address}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {property.type}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-foreground">
                        {formatPrice(property.price)}
                      </td>
                      <td className="py-2 px-2 text-right text-foreground">
                        {property.sqft.toLocaleString()}
                      </td>
                      <td className="py-2 px-2 text-center text-foreground">
                        {property.beds}/{property.baths}
                      </td>
                      <td className="py-2 px-2 text-right text-foreground">
                        ${property.pricePerSqft}
                      </td>
                      <td className="py-2 px-2 text-center text-foreground">
                        {property.dom}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {properties.length > 15 && (
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Showing first 15 of {properties.length} total listings. Download CSV for complete dataset.
                </p>
              )}
            </div>
          </motion.div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-border text-center text-sm text-muted-foreground print:mt-4">
            <p>
              This report was generated by Aura Estates Intelligence Platform on {reportDate}
            </p>
            <p className="text-xs mt-1">
              Data sourced from Bridge Data Output API. For informational purposes only.
            </p>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          [class*="bento-card"] {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
