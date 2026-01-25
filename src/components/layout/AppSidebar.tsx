import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Building2,
  Calculator,
  Shield,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MapPin,
  TrendingDown,
  Briefcase,
  FileText,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    title: "Market Overview",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Property Analysis",
    path: "/property-analysis",
    icon: Building2,
  },
  {
    title: "Neighborhoods",
    path: "/neighborhoods",
    icon: MapPin,
  },
  {
    title: "Market Opportunities",
    path: "/price-drops",
    icon: TrendingDown,
  },
  {
    title: "Portfolio Tracker",
    path: "/portfolio",
    icon: Briefcase,
  },
  {
    title: "Financial Forecaster",
    path: "/financial-forecaster",
    icon: Calculator,
  },
  {
    title: "Reports",
    path: "/reports",
    icon: FileText,
  },
  {
    title: "Admin Dashboard",
    path: "/data-management",
    icon: Shield,
  },
];

// Jennifer's Insight Dashboards
const insightItems = [
  // {
  //   title: "Active Insights",
  //   path: "/insights/active",
  //   icon: Activity,
  // },
  // {
  //   title: "Pending Insights",
  //   path: "/insights/pending",
  //   icon: Clock,
  // },
  // {
  //   title: "Sold Analytics",
  //   path: "/insights/sold",
  //   icon: CheckCircle2,
  // },
  // {
  //   title: "Under Contract",
  //   path: "/insights/contingent",
  //   icon: AlertTriangle,
  // },
  // {
  //   title: "Withdrawn Analysis",
  //   path: "/insights/withdrawn",
  //   icon: XCircle,
  // },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const [user] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const isAdmin = user?.role === 'admin';

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "h-screen sticky top-0 flex flex-col border-r bg-sidebar border-sidebar-border",
        "transition-colors duration-300"
      )}
    >
      {/* Logo Section */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary">
          <TrendingUp className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col"
          >
            <span className="font-display font-bold text-lg text-sidebar-foreground">
              Aura Estates
            </span>
            <span className="text-xs text-muted-foreground">Intelligence</span>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems
          .filter(item => item.title !== "Admin Dashboard" || isAdmin)
          .map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200",
                "hover:bg-sidebar-accent group relative",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-sidebar-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 flex-shrink-0 transition-colors",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground group-hover:text-sidebar-foreground"
                )}
              />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-medium text-sm"
                >
                  {item.title}
                </motion.span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground rounded-md text-sm font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg border z-50">
                  {item.title}
                </div>
              )}
            </NavLink>
          );
        })}

        {/* Insights Section Divider */}
        {!collapsed && (
          <div className="pt-4 pb-2">
            <div className="flex items-center gap-2 px-3">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Status Insights
              </span>
            </div>
          </div>
        )}
        {collapsed && <div className="h-4" />}

        {/* Insight Navigation Items */}
        {insightItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                "hover:bg-sidebar-accent group relative",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-sidebar-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground group-hover:text-sidebar-foreground"
                )}
              />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-medium text-sm"
                >
                  {item.title}
                </motion.span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground rounded-md text-sm font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg border z-50">
                  {item.title}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </motion.aside>
  );
}
