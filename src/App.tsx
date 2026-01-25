import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import MarketOverview from "./pages/MarketOverview";
import PropertyAnalysis from "./pages/PropertyAnalysis";
import PropertyDetail from "./pages/PropertyDetail";
import NeighborhoodAnalysis from "./pages/NeighborhoodAnalysis";
import PriceDropTracker from "./pages/PriceDropTracker";
import PortfolioTracker from "./pages/PortfolioTracker";
import FinancialForecaster from "./pages/FinancialForecaster";
import ReportGenerator from "./pages/ReportGenerator";
import DataManagement from "./pages/DataManagement";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
// Jennifer's Insight Dashboards
import ActiveInsights from "./pages/ActiveInsights";
import PendingInsights from "./pages/PendingInsights";
import SoldAnalytics from "./pages/SoldAnalytics";
import ContingentAnalysis from "./pages/ContingentAnalysis";
import WithdrawnAnalysis from "./pages/WithdrawnAnalysis";

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Admin-only Route component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('authToken');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<MarketOverview />} />
            <Route path="/property-analysis" element={<PropertyAnalysis />} />
            <Route path="/property/:id" element={<PropertyDetail />} />
            <Route path="/neighborhoods" element={<NeighborhoodAnalysis />} />
            <Route path="/price-drops" element={<PriceDropTracker />} />
            <Route path="/portfolio" element={<PortfolioTracker />} />
            <Route path="/financial-forecaster" element={<FinancialForecaster />} />
            <Route path="/reports" element={<ReportGenerator />} />
          </Route>
          
          {/* Admin-only routes */}
          <Route element={<AdminRoute><AppLayout /></AdminRoute>}>
            <Route path="/data-management" element={<DataManagement />} />
          </Route>
          
          {/* Protected routes continued */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            {/* Jennifer's Insight Dashboards */}
            {/* <Route path="/insights/active" element={<ActiveInsights />} />
            <Route path="/insights/pending" element={<PendingInsights />} />
            <Route path="/insights/sold" element={<SoldAnalytics />} />
            <Route path="/insights/contingent" element={<ContingentAnalysis />} />
            <Route path="/insights/withdrawn" element={<WithdrawnAnalysis />} /> */}
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
