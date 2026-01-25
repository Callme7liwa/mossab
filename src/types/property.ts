// Type definitions for property data

export interface SimpleProperty {
  id: string;
  mlsId: string;
  address: string;
  addressKey?: string;
  city: string;
  neighborhood: string;
  price: number;
  originalPrice: number;
  closePrice?: number | null;
  beds: number;
  baths: number;
  sqft: number;
  lotSize: number;
  yearBuilt: number | null;
  propertyType: string;
  type: string;
  status: string;
  dom: number;
  listDate: string | null;
  offMarketDate?: string | null;
  closeDate?: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrl: string | null;
  photos?: Array<{ MediaURL: string; MediaType?: string }>;
  photosCount?: number;
  pricePerSqft: number;
  prevMarketTime?: number | null;
}

export interface MarketStats {
  medianPrice: number;
  avgPricePerSqft: number;
  totalInventory: number;
  avgDaysOnMarket: number;
}

export interface FetchPropertiesOptions {
  filter?: string;
  top?: number;
  city?: string;
}
