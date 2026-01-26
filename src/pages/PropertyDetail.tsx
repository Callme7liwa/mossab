import { useMemo, useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bed,
  Bath,
  Square,
  MapPin,
  Calendar,
  DollarSign,
  Home,
  TrendingUp,
  Building2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Navigation,
  History,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { LastUpdated } from "@/components/dashboard/LastUpdated";
import { useProperties } from "@/hooks/useProperties";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// Haversine formula to calculate distance between two lat/lng points in miles
function getDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface ListingHistoryItem {
  id: string;
  status: string;
  price: number;
  closePrice?: number;
  listDate: string;
  closeDate?: string;
  dom: number;
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { properties, loading, refetch, lastUpdated } = useProperties({ top: 2000 }); // Increased for better comps
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [searchRadius, setSearchRadius] = useState(10); // Default 10 miles
  const [listingHistory, setListingHistory] = useState<ListingHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const property = useMemo(() => {
    return properties.find((p) => p.id === id);
  }, [properties, id]);

  // Fetch listing history for this property
  useEffect(() => {
    if (!id) return;
    
    setHistoryLoading(true);
    fetch(`${BACKEND_URL}/api/properties/${id}/history`)
      .then(res => res.json())
      .then(data => {
        if (data.history && data.history.length > 1) {
          setListingHistory(data.history);
        } else {
          setListingHistory([]);
        }
      })
      .catch(err => console.error('Error fetching history:', err))
      .finally(() => setHistoryLoading(false));
  }, [id]);

  // Find comparable properties with geographic radius and smart filtering
  const comparables = useMemo(() => {
    if (!property) return [];
    
    // Dynamic price range based on property value (higher price = wider range)
    const priceMultiplier = property.price >= 2000000 ? 0.30 : // 30% for $2M+
                           property.price >= 1000000 ? 0.25 : // 25% for $1M+
                           0.20; // 20% for others
    const priceRange = property.price * priceMultiplier;
    
    // Filter by multiple criteria
    let comps = properties.filter((p) => {
      if (p.id === property.id) return false;
      
      // Price range filter
      if (Math.abs(p.price - property.price) > priceRange) return false;
      
      // Geographic filter (if coordinates available)
      if (property.latitude && property.longitude && p.latitude && p.longitude) {
        const distance = getDistanceMiles(
          property.latitude, property.longitude,
          p.latitude, p.longitude
        );
        if (distance > searchRadius) return false;
      }
      
      // Similar beds (within 1)
      if (Math.abs((p.beds || 0) - (property.beds || 0)) > 1) return false;
      
      return true;
    });

    // Calculate distance and score for each comp
    comps = comps.map(comp => ({
      ...comp,
      distance: property.latitude && property.longitude && comp.latitude && comp.longitude
        ? getDistanceMiles(property.latitude, property.longitude, comp.latitude, comp.longitude)
        : null,
      // Similarity score: closer distance + closer price = better
      score: (
        (priceRange > 0 ? (1 - Math.abs(comp.price - property.price) / priceRange) * 50 : 25) +
        (property.latitude && comp.latitude 
          ? (1 - getDistanceMiles(property.latitude, property.longitude, comp.latitude!, comp.longitude!) / searchRadius) * 50
          : 25)
      )
    }));

    // Sort by score (best matches first) and take top 6
    return comps
      .sort((a, b) => (b as any).score - (a as any).score)
      .slice(0, 6);
  }, [properties, property, searchRadius]);

  // Calculate price appreciation if multiple closed sales
  const priceAppreciation = useMemo(() => {
    const closedListings = listingHistory.filter(l => l.status === 'Closed' && l.closePrice);
    if (closedListings.length < 2) return null;
    
    const sorted = closedListings.sort((a, b) => 
      new Date(a.closeDate || '').getTime() - new Date(b.closeDate || '').getTime()
    );
    
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    
    if (!first.closePrice || !last.closePrice) return null;
    
    const appreciation = ((last.closePrice - first.closePrice) / first.closePrice * 100);
    const yearsBetween = (new Date(last.closeDate || '').getTime() - new Date(first.closeDate || '').getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    
    return {
      totalPercent: appreciation.toFixed(1),
      annualized: yearsBetween > 0 ? (appreciation / yearsBetween).toFixed(1) : null,
      firstPrice: first.closePrice,
      lastPrice: last.closePrice,
      years: yearsBetween.toFixed(1)
    };
  }, [listingHistory]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="space-y-6">
        <Link to="/property-analysis">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Properties
          </Button>
        </Link>
        <div className="bento-card text-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Property Not Found</h2>
          <p className="text-muted-foreground">The property you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <Link to="/property-analysis">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Properties
            </Button>
          </Link>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {property.address}
          </h1>
          <p className="text-muted-foreground">{property.neighborhood}</p>
        </div>
        <LastUpdated timestamp={lastUpdated} loading={loading} onRefresh={refetch} />
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Property Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property Photos Carousel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bento-card aspect-video relative overflow-hidden group"
          >
            {property.photos && property.photos.length > 0 ? (
              <>
                <img
                  src={property.photos[currentPhotoIndex]?.MediaURL}
                  alt={`${property.address} - Photo ${currentPhotoIndex + 1}`}
                  className="w-full h-full object-cover transition-all duration-300"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                {/* Navigation Arrows */}
                {property.photos.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                      onClick={() => setCurrentPhotoIndex(prev => prev > 0 ? prev - 1 : property.photos.length - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                      onClick={() => setCurrentPhotoIndex(prev => prev < property.photos.length - 1 ? prev + 1 : 0)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                )}
                {/* Photo Counter */}
                {property.photos.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
                    {currentPhotoIndex + 1} / {property.photos.length}
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                <div className="text-center">
                  <Home className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No Photos Available</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Photos may be available with direct MLS access
                  </p>
                </div>
              </div>
            )}
            <Badge className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm">
              {property.status}
            </Badge>
          </motion.div>

          {/* Key Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <Card className="p-4 text-center">
              <Bed className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{property.beds}</p>
              <p className="text-xs text-muted-foreground">Bedrooms</p>
            </Card>
            <Card className="p-4 text-center">
              <Bath className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{property.baths}</p>
              <p className="text-xs text-muted-foreground">Bathrooms</p>
            </Card>
            <Card className="p-4 text-center">
              <Square className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">
                {property.sqft.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Sq Ft</p>
            </Card>
            <Card className="p-4 text-center">
              <Calendar className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{property.dom}</p>
              <p className="text-xs text-muted-foreground">Days on Market</p>
            </Card>
          </motion.div>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bento-card"
          >
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Property Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Property Type</span>
                <span className="font-medium text-foreground">{property.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price per Sq Ft</span>
                <span className="font-medium text-foreground">
                  ${Math.round(property.price / property.sqft)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-foreground">{property.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Neighborhood</span>
                <span className="font-medium text-foreground">{property.neighborhood}</span>
              </div>
            </div>
          </motion.div>

          {/* Listing History (if multiple listings exist) */}
          {listingHistory.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bento-card border-l-4 border-l-amber-500"
            >
              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-amber-500" />
                <h3 className="font-display text-lg font-semibold text-foreground">
                  Listing History
                </h3>
                <Badge variant="secondary" className="ml-auto">
                  {listingHistory.length} listings
                </Badge>
              </div>

              {/* Appreciation Summary */}
              {priceAppreciation && (
                <div className="bg-secondary/50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Price Change</span>
                    <span className={`text-sm font-bold ${Number(priceAppreciation.totalPercent) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {Number(priceAppreciation.totalPercent) >= 0 ? '+' : ''}{priceAppreciation.totalPercent}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatPrice(priceAppreciation.firstPrice)} → {formatPrice(priceAppreciation.lastPrice)}</span>
                    <span>over {priceAppreciation.years} years</span>
                  </div>
                  {priceAppreciation.annualized && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ~{priceAppreciation.annualized}% per year
                    </p>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-3">
                {listingHistory.map((listing, index) => (
                  <div key={listing.id} className="relative pl-6">
                    {/* Timeline line */}
                    {index < listingHistory.length - 1 && (
                      <div className="absolute left-[9px] top-5 w-0.5 h-full bg-border" />
                    )}
                    {/* Timeline dot */}
                    <div className={`absolute left-0 top-1 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
                      listing.status === 'Closed' ? 'bg-green-500 border-green-500' :
                      listing.status === 'Active' ? 'bg-blue-500 border-blue-500' :
                      listing.status === 'Withdrawn' ? 'bg-red-500 border-red-500' :
                      'bg-amber-500 border-amber-500'
                    }`}>
                      {listing.id === id && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    
                    <div className={`pb-3 ${listing.id === id ? 'bg-primary/5 -mx-2 px-2 py-1 rounded' : ''}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          listing.status === 'Closed' ? 'default' :
                          listing.status === 'Active' ? 'secondary' :
                          listing.status === 'Withdrawn' ? 'destructive' : 'outline'
                        } className="text-[10px]">
                          {listing.status}
                        </Badge>
                        {listing.id === id && (
                          <span className="text-[10px] text-primary font-medium">Current</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-semibold text-foreground">
                          {listing.status === 'Closed' && listing.closePrice 
                            ? formatPrice(listing.closePrice)
                            : formatPrice(listing.price)
                          }
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {listing.status === 'Closed' && listing.closeDate
                            ? new Date(listing.closeDate).toLocaleDateString()
                            : listing.listDate 
                              ? new Date(listing.listDate).toLocaleDateString()
                              : 'N/A'
                          }
                        </span>
                      </div>
                      {listing.dom > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          {listing.dom} days on market
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Flip Warning */}
              {listingHistory.filter(l => l.status === 'Closed').length >= 2 && (
                <div className="flex items-start gap-2 mt-3 p-2 bg-amber-500/10 rounded text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>This property has sold {listingHistory.filter(l => l.status === 'Closed').length} times in 5 years - potential flip activity</span>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Right Column - Price & Comparables */}
        <div className="space-y-6">
          {/* Price Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bento-card bg-primary text-primary-foreground"
          >
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm opacity-90">Listing Price</span>
            </div>
            <p className="text-3xl font-bold">{formatPrice(property.price)}</p>
            <p className="text-sm opacity-75 mt-2">
              ${Math.round(property.price / property.sqft)}/sq ft
            </p>
          </motion.div>

          {/* Investment Quick Calc */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bento-card"
          >
            <h3 className="font-display text-lg font-semibold text-foreground mb-4">
              Quick Investment Calc
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">20% Down Payment</span>
                <span className="font-medium text-foreground">
                  {formatPrice(property.price * 0.2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Monthly (6.5%)</span>
                <span className="font-medium text-foreground">
                  {formatPrice(
                    ((property.price * 0.8) * (0.065 / 12) * Math.pow(1 + 0.065 / 12, 360)) /
                      (Math.pow(1 + 0.065 / 12, 360) - 1)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Monthly Rent</span>
                <span className="font-medium text-foreground">
                  {formatPrice(property.price * 0.006)}
                </span>
              </div>
              <hr className="border-border" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Cap Rate</span>
                <span className="font-medium text-primary">
                  {property.price > 0 ? ((property.price * 0.006 * 12) / property.price * 100).toFixed(1) : "0.0"}%
                </span>
              </div>
            </div>
            <Link to="/financial-forecaster">
              <Button className="w-full mt-4" variant="outline">
                <TrendingUp className="w-4 h-4 mr-2" />
                Full Calculator
              </Button>
            </Link>
          </motion.div>

          {/* Comparable Properties */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bento-card"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-lg font-semibold text-foreground">
                Comparable Sales
              </h3>
              <Badge variant="outline" className="text-xs">
                {comparables.length} found
              </Badge>
            </div>
            
            {/* Radius Slider */}
            <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Navigation className="w-3 h-3" />
                  Search Radius
                </span>
                <span className="text-xs font-medium text-foreground">
                  {searchRadius} miles
                </span>
              </div>
              <Slider
                value={[searchRadius]}
                onValueChange={(value) => setSearchRadius(value[0])}
                min={1}
                max={15}
                step={1}
                className="w-full"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Expand radius for luxury properties with fewer comps
              </p>
            </div>

            {comparables.length === 0 ? (
              <div className="text-center py-4">
                <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No comparable properties found within {searchRadius} miles
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try increasing the search radius
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {comparables.map((comp) => (
                  <Link key={comp.id} to={`/property/${comp.id}`}>
                    <Card className="p-3 hover:bg-secondary/50 transition-colors cursor-pointer">
                      <p className="text-sm font-medium text-foreground truncate">
                        {comp.address}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">
                          {comp.beds}bd / {comp.baths}ba • {comp.sqft.toLocaleString()} sqft
                        </span>
                        <span className="text-sm font-semibold text-primary">
                          {formatPrice(comp.price)}
                        </span>
                      </div>
                      {(comp as any).distance !== null && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {(comp as any).distance.toFixed(1)} miles away
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            ${Math.round(comp.price / comp.sqft)}/sqft
                          </span>
                        </div>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
