# Data Caching Implementation Guide

## Summary of Changes

Your application now implements **intelligent client-side caching** to prevent unnecessary API calls while maintaining fresh data with a daily refresh cycle.

---

## Problem Solved

### 1. **Over-fetching Data**
- **Before**: Every page independently called `useProperties()`, triggering multiple API calls
- **Before**: `PriceTrendChart` had duplicate API calls
- **Before**: Auto-polling every 5 minutes caused constant API usage
- **After**: Single cached dataset shared across all pages, only refreshed when stale

### 2. **Data Utilization**
- The app only uses a **subset of API data** for dashboard visualizations:
  - Price distribution
  - Market statistics (median price, avg price/sqft, inventory, days on market)
  - Property type distribution
  - Basic property details (address, beds, baths, price, sqft)
- **Not currently using**: Heating/cooling systems, agent info, detailed address components, etc.

---

## How It Works

### Cache Flow
```
1. App starts → Check localStorage cache
2. Cache valid (< 24 hours)? → Use cached data immediately ✅
3. Cache invalid/missing? → Fetch from Bridge API
4. Save data to cache → Update UI
5. Window focus? → Only refetch if cache > 24 hours old
6. User clicks "Refresh"? → Force API call and update cache
```

### Files Created/Modified

#### New Files:
- **[cacheManager.ts](src/lib/api/cacheManager.ts)** - Cache operations (save, load, validate, export)
- **[CacheStatus.tsx](src/components/dashboard/CacheStatus.tsx)** - Cache status indicator component

#### Modified Files:
- **[useProperties.ts](src/hooks/useProperties.ts)** - Now uses cache before API calls
- **[PriceTrendChart.tsx](src/components/dashboard/PriceTrendChart.tsx)** - Removed duplicate API call
- **[DataManagement.tsx](src/pages/DataManagement.tsx)** - Added cache management UI

---

## Usage & Features

### For Users:

**Data Management Page** (`/data-management`) now includes:
- ✅ **Cache Status**: Shows if data is cached and when it was last updated
- ✅ **Force Refresh**: Manually trigger API call to get latest data
- ✅ **Download Cache**: Export cached data as JSON file for backup/analysis
- ✅ **Clear Cache**: Remove all cached data to start fresh

### Cache Behavior:

| Scenario | Action |
|----------|--------|
| First visit | Loads cache if available, otherwise fetches from API |
| Navigate between pages | Uses same cached dataset (no new API calls) |
| Return to app after 24+ hours | Auto-refreshes cache in background |
| Window focus (after cache expired) | Auto-refreshes cache silently |
| API fails | Falls back to cached data from previous session |

---

## Database vs JSON File Decision

### Why **localStorage (JSON)** is best for your use case:

✅ **Advantages:**
- Built-in browser storage (no extra dependencies)
- 5-10MB limit per domain (more than enough for 200 properties)
- Simple key-value interface
- Synchronous access (no async complexity)
- Easy to export/backup as JSON
- Works offline (cached data still accessible)

❌ **Why NOT a database:**
- Adds server infrastructure complexity
- Requires backend synchronization
- Overkill for simple daily refresh pattern
- Extra latency vs localStorage

---

## Implementation Details

### Cache Data Structure
```typescript
{
  properties: SimpleProperty[],      // Transformed property objects
  stats: MarketStats,                 // Calculated market statistics
  timestamp: number                   // Unix timestamp of cache
}
```

### Cache Duration
- **24 hours** (86,400,000 milliseconds)
- Configurable in `cacheManager.ts` as `CACHE_DURATION`
- Only refreshes once per day automatically
- Manual refresh available anytime

### API Call Reduction
**Before:** ~288 calls/day (5-minute polling) × number of pages visited  
**After:** ~1 call/day (only daily refresh) + occasional manual refresh  
**Reduction:** ~99.6% fewer API calls ✨

---

## How to Customize

### Change Cache Duration:
Edit [cacheManager.ts](src/lib/api/cacheManager.ts) line 10:
```typescript
// 24 hours in milliseconds (change to desired duration)
const CACHE_DURATION = 24 * 60 * 60 * 1000;
```

### Change Auto-Refresh Behavior:
Edit [useProperties.ts](src/hooks/useProperties.ts) to adjust when refetch happens:
- Currently: On window focus if cache > 24h old
- Can add: Manual schedule, time-based checks, etc.

### Use Across Components:
```tsx
// Any component can access cached data
const { properties, stats, loading, lastUpdated, isCached } = useProperties();

// isCached indicates if data came from cache
if (isCached) {
  console.log("Using cached data");
}
```

---

## API Data Not Being Used

These fields are fetched but not currently utilized:
- Property heating/cooling systems
- Full listing agent information
- Building area vs living area distinction
- Garage/parking spaces
- Pool/fireplace features
- Tax information
- Association fees
- Detailed timestamps (original entry, modification, etc.)

Consider these for future features like:
- Advanced property filtering
- Agent directory
- Feature-based recommendations
- Detailed property profiles

---

## Testing the Cache

1. **First load**: Network tab shows Bridge API call ✓
2. **Page navigation**: No new API calls (same cached data) ✓
3. **Manual refresh**: Forces new API call ✓
4. **Export**: Downloads JSON with cached properties ✓
5. **After 24h**: Auto-refresh triggers on window focus ✓
6. **Clear cache**: Next load fetches fresh data ✓

---

## Next Steps (Optional)

1. **Schedule daily refresh**: Use `node-cron` backend task
2. **Sync with IndexedDB**: For larger datasets (>10,000 properties)
3. **Implement data versioning**: Track schema changes
4. **Add analytics**: Monitor cache hits vs API calls
5. **Create data pipeline**: Process raw API data for better insights
