import { useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, Layers, Loader2 } from "lucide-react";
import { useProperties } from "@/hooks/useProperties";

interface Hotspot {
  x: number;
  y: number;
  intensity: "high" | "medium" | "low";
  name: string;
  count: number;
  avgDOM: number;
}

const intensityColors = {
  high: "bg-primary",
  medium: "bg-accent",
  low: "bg-chart-3",
};

export function MapPlaceholder() {
  const { properties, loading } = useProperties({ top: 200 });

  // Calculate hotspots from live API data
  const hotspots = useMemo<Hotspot[]>(() => {
    if (properties.length === 0) return [];

    // Group properties by neighborhood
    const neighborhoods: Record<string, { count: number; totalDOM: number }> = {};
    
    properties.forEach((p) => {
      const area = p.neighborhood || "Unknown";
      if (!neighborhoods[area]) {
        neighborhoods[area] = { count: 0, totalDOM: 0 };
      }
      neighborhoods[area].count += 1;
      neighborhoods[area].totalDOM += p.dom || 0;
    });

    // Convert to array and calculate metrics
    const areaData = Object.entries(neighborhoods)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgDOM: data.count > 0 ? data.totalDOM / data.count : 0,
      }))
      .filter((a) => a.name !== "Unknown")
      .sort((a, b) => b.count - a.count)
      .slice(0, 6); // Top 6 neighborhoods

    if (areaData.length === 0) return [];

    // Determine intensity based on listing count and DOM
    const maxCount = Math.max(...areaData.map((a) => a.count));
    const minDOM = Math.min(...areaData.map((a) => a.avgDOM));

    return areaData.map((area, index) => {
      // Generate pseudo-random but consistent positions based on name
      const hash = area.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const x = 15 + ((hash * 17) % 70);
      const y = 15 + ((hash * 31) % 65);

      // Intensity based on count (high count = high activity) and DOM (low DOM = high activity)
      let intensity: "high" | "medium" | "low" = "low";
      const countScore = area.count / maxCount;
      const domScore = minDOM > 0 ? minDOM / (area.avgDOM || 1) : 0.5;
      const activityScore = countScore * 0.6 + domScore * 0.4;

      if (activityScore > 0.65) intensity = "high";
      else if (activityScore > 0.35) intensity = "medium";

      return {
        x,
        y,
        intensity,
        name: area.name,
        count: area.count,
        avgDOM: Math.round(area.avgDOM),
      };
    });
  }, [properties]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bento-card relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            Property Hotspots
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Market activity by neighborhood
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <Layers className="w-4 h-4" />
        </div>
      </div>

      {/* Map Container */}
      <div className="relative h-[280px] rounded-lg bg-secondary/50 overflow-hidden">
        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--border)) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {loading && hotspots.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          /* Hotspots */
          hotspots.map((spot, index) => (
            <motion.div
              key={spot.name}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="absolute group cursor-pointer"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            >
              {/* Pulse Effect */}
              <div
                className={`absolute -inset-4 rounded-full ${intensityColors[spot.intensity]} opacity-20 animate-ping`}
              />
              <div
                className={`absolute -inset-2 rounded-full ${intensityColors[spot.intensity]} opacity-30`}
              />
              <div
                className={`relative w-4 h-4 rounded-full ${intensityColors[spot.intensity]} flex items-center justify-center shadow-lg`}
              >
                <MapPin className="w-2.5 h-2.5 text-primary-foreground" />
              </div>

              {/* Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-16 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-lg whitespace-nowrap">
                  <p className="text-xs font-medium text-foreground">{spot.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {spot.intensity} activity
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {spot.count} listings • {spot.avgDOM} avg DOM
                  </p>
                </div>
              </div>
            </motion.div>
          ))
        )}

        {/* Legend */}
        <div className="absolute bottom-3 right-3 bg-popover/90 backdrop-blur-sm border border-border rounded-lg p-2 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">High</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-muted-foreground">Medium</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full bg-chart-3" />
            <span className="text-muted-foreground">Low</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
