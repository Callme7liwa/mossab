const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export interface Permit {
  id: number;
  record_no: string;
  address: string;
  address_normalized: string;
  street_number: string;
  street_name: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  permit_type: string;
  project_type: string;
  type_of_work: string;
  description: string;
  date_submitted: string;
  record_status: string;
  applicant_name: string;
  owner_name: string;
  estimated_cost: number | null;
  demolition_cost: number | null;
  demolition_date: string | null;
  lot_area: number | null;
  zoning: string;
  year_built: number | null;
  list_price: number | null;
  mls_number: string | null;
  listing_agent: string | null;
  listing_status: string | null;
  source_sheet: string;
  source_file: string;
  match_count?: number;
  best_match_score?: number;
  created_at: string;
}

export interface PermitMatch {
  id: number;
  permit_id: number;
  mls_list_no: string;
  mls_address: string;
  mls_list_date: string;
  mls_offer_date: string;
  mls_settled_date: string;
  mls_list_price: number;
  mls_sale_price: number;
  mls_sqft: number;
  mls_bedrooms: number;
  mls_bathrooms: number;
  mls_year_built: number;
  mls_lot_size: number;
  match_score: number;
  match_type: string;
  is_confirmed: number;
}

export interface PermitStats {
  total: number;
  matched: number;
  unmatched: number;
  highConfidenceMatches: number;
  matchesWithSales: number;
  avgMatchScore: number;
  totalSalesValue: number;
  byYear: { year: string; count: number }[];
  byStatus: { record_status: string; count: number }[];
  byProjectType: { project_type: string; count: number }[];
  totalEstimatedCost: number;
  avgEstimatedCost: number;
}

export interface PermitAnalytics {
  summary: {
    avgDaysToList: number | null;
    avgDaysToSale: number | null;
    avgSaleToCostRatio: string | null;
    totalAnalyzed: number;
  };
  byYear: {
    permit_year: string;
    permits: number;
    sales: number;
    avg_sale_price: number;
    avg_construction_cost: number;
    avg_days_to_sale: number;
  }[];
  topBuilders: {
    builder: string;
    permit_count: number;
    total_construction_cost: number;
    avg_construction_cost: number;
  }[];
  details: {
    id: number;
    address: string;
    date_submitted: string;
    estimated_cost: number;
    mls_list_date: string;
    mls_settled_date: string;
    mls_sale_price: number;
    days_to_list: number;
    days_to_sale: number;
    sale_to_cost_ratio: number;
  }[];
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('authToken');
  
  // Debug: Log token status
  if (!token) {
    console.warn('No auth token found in localStorage for permits API call:', endpoint);
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Merge with any additional headers from options
  if (options?.headers) {
    Object.assign(headers, options.headers);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

export const permitsApi = {
  // List permits
  list: (params?: { status?: string; year?: string; hasMatch?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.year) query.set('year', params.year);
    if (params?.hasMatch) query.set('hasMatch', params.hasMatch);
    if (params?.limit) query.set('limit', String(params.limit));
    return fetchApi<{ count: number; permits: Permit[] }>(`/api/permits?${query}`);
  },

  // Get permit stats
  stats: () => fetchApi<PermitStats>('/api/permits/stats'),

  // Get analytics
  analytics: () => fetchApi<PermitAnalytics>('/api/permits/analytics'),

  // Get single permit with matches
  get: (id: number) => fetchApi<{ permit: Permit; matches: PermitMatch[] }>(`/api/permits/${id}`),

  // Import permits from JSON
  import: (permits: Record<string, unknown>[], sourceFile?: string) =>
    fetchApi<{ imported: number; skipped: number; errors: unknown[]; matching?: unknown }>(
      '/api/permits/import',
      {
        method: 'POST',
        body: JSON.stringify({ permits, sourceFile }),
      }
    ),

  // Import from Excel file path (server-side)
  importExcel: (filePath: string, sheets?: string[]) =>
    fetchApi<{ total: number; bySheet: Record<string, number>; matching?: unknown }>(
      '/api/permits/import-excel',
      {
        method: 'POST',
        body: JSON.stringify({ filePath, sheets }),
      }
    ),

  // Run matching
  match: () =>
    fetchApi<{ matched: number; unmatched: number; total: number }>('/api/permits/match', {
      method: 'POST',
    }),

  // Confirm a match
  confirmMatch: (permitId: number, matchId: number) =>
    fetchApi<{ success: boolean }>(`/api/permits/${permitId}/confirm-match`, {
      method: 'POST',
      body: JSON.stringify({ matchId }),
    }),

  // Manual match
  manualMatch: (permitId: number, mlsListNo: string, mlsAddress?: string) =>
    fetchApi<{ success: boolean }>(`/api/permits/${permitId}/manual-match`, {
      method: 'POST',
      body: JSON.stringify({ mlsListNo, mlsAddress }),
    }),

  // Delete permit
  delete: (id: number) =>
    fetchApi<{ success: boolean }>(`/api/permits/${id}`, { method: 'DELETE' }),

  // Clear all permits
  clearAll: () => fetchApi<{ success: boolean }>('/api/permits', { method: 'DELETE' }),
};

export default permitsApi;
