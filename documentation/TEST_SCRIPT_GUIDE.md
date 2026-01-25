# Test Script Usage Guide

## Quick Commands

```bash
# Run ALL tests
npm run test-api

# Or use Node directly
node scripts/test-bridge-api.js all
```

## Individual Tests

### 1. Connection Test
```bash
node scripts/test-bridge-api.js connection
```
**What it does:** Verifies API is accessible and shows total property count  
**Use when:** You suspect API connectivity issues

**Output:**
```
✅ Connection successful!
   Total properties available: 4,528,641
```

---

### 2. Data Structure Test
```bash
node scripts/test-bridge-api.js structure
```
**What it does:** Analyzes the shape of API response data  
**Use when:** You want to understand what fields are available

**Output:**
```
✅ Retrieved 10 properties
   Total fields per property: 389
   Sample property ID: d9dc64195c2ded853e6e18f94db6f9a7
   Address: 18 Beaconwood Road # 18, Newton MA 02461
```

---

### 3. Field Types Test
```bash
node scripts/test-bridge-api.js fields
```
**What it does:** Detailed analysis of each field's data type and population rate  
**Use when:** You need to understand data quality and which fields are populated

**Output:**
```
ADDRESS
  ✅ StreetNumber           | Type: string      | Populated: 100% (50/50)
  ✅ City                   | Type: string      | Populated: 100% (50/50)
  ❌ PostalCode             | Type: string      | Populated: 38% (19/50)

PRICE
  ✅ ListPrice              | Type: number      | Populated: 100% (50/50)
  ✅ ClosePrice             | Type: number      | Populated: 100% (50/50)
```

---

### 4. Filtering Test
```bash
node scripts/test-bridge-api.js filters
```
**What it does:** Tests various OData filters to see how many properties match  
**Use when:** You want to optimize which data to fetch

**Output:**
```
✅ All Properties
   Count: 4,528,641 properties

✅ Active + Pending
   Filter: StandardStatus eq 'Active' or StandardStatus eq 'Pending'
   Count: 25,442 properties

✅ Combined Filter (Active/Pending residential $200k-$1M)
   Count: 8,282 properties
```

**This helps you:**
- See impact of adding filters
- Understand data distribution
- Plan cache size

---

### 5. Status Values Test
```bash
node scripts/test-bridge-api.js status
```
**What it does:** Shows distribution of property status values  
**Use when:** You need to know what statuses exist in the data

**Possible Values:**
- Active
- Pending
- Closed/Sold
- Canceled
- Expired
- Withdrawn

---

### 6. Property Types Test
```bash
node scripts/test-bridge-api.js types
```
**What it does:** Shows property types and subtypes distribution  
**Use when:** You want to filter by property type

**Output:**
```
✅ Primary Property Types:
   "Residential": 3,070,088 properties

✅ Sub-Types (Top 10):
   "Condominium": majority
   "Stock Cooperative": some
   "House": some
```

---

### 7. Performance Test
```bash
node scripts/test-bridge-api.js performance
```
**What it does:** Measures API response times with different field selections  
**Use when:** You're optimizing API calls or need SLA metrics

**Output:**
```
✅ Minimal (5 fields)
   Time: 502ms
   Response Size: 27.47 KB
   Size per property: 281 bytes

✅ Full (all 389 fields)
   Time: 469ms
   Response Size: 1010 KB
   Size per property: 10.1 KB
```

**Key Insight:** Minimal fields (5) = smaller response but same fetch time!

---

### 8. Help
```bash
node scripts/test-bridge-api.js questions
```
**Shows:** List of all available commands

---

## Real-World Usage Examples

### Scenario 1: Check if API is still working
```bash
node scripts/test-bridge-api.js connection
```
Should see `✅ Connection successful!`

### Scenario 2: Verify data hasn't changed
```bash
node scripts/test-bridge-api.js filters
```
Compare Active + Pending count to previous run

### Scenario 3: Optimize API calls
```bash
# Run fields test to see populated percentages
node scripts/test-bridge-api.js fields

# Then run filters to see how many properties match your criteria
node scripts/test-bridge-api.js filters

# Then run performance to see response times
node scripts/test-bridge-api.js performance
```

### Scenario 4: Debug cache issues
```bash
# Run structure to understand data
node scripts/test-bridge-api.js structure

# Run fields to verify expected data exists
node scripts/test-bridge-api.js fields

# Compare with your cached data
```

---

## Adding to package.json

Already added! You can run:

```bash
npm run test-api              # Runs: node scripts/test-bridge-api.js all
```

Or add more shortcuts to `package.json`:

```json
{
  "scripts": {
    "test-api": "node scripts/test-bridge-api.js all",
    "test-api:connection": "node scripts/test-bridge-api.js connection",
    "test-api:fields": "node scripts/test-bridge-api.js fields",
    "test-api:filters": "node scripts/test-bridge-api.js filters",
    "test-api:perf": "node scripts/test-bridge-api.js performance"
  }
}
```

---

## Troubleshooting

### "Connection failed: 401 Unauthorized"
**Problem:** API token expired or invalid  
**Solution:** Check token in `src/lib/api/bridgeApi.ts`

### "No properties found"
**Problem:** Filter is too restrictive  
**Solution:** Run `node scripts/test-bridge-api.js filters` to see what matches

### "Cannot read properties of undefined"
**Problem:** Empty result set  
**Solution:** Check filter syntax in test script

### "Timeout"
**Problem:** API is slow or unreachable  
**Solution:** 
1. Check internet connection
2. Try again (API might be temporarily busy)
3. Run `connection` test

---

## Pro Tips

1. **Run before deploying** - Verify API connectivity in production environment
2. **Schedule weekly runs** - Monitor data health
3. **Log results** - Track property count trends
4. **Compare runs** - See how market changes over time
5. **Use filters parameter** - Test your exact query before caching

---

## Next Steps

1. Run the full test suite: `node scripts/test-bridge-api.js all`
2. Review BRIDGE_API_ANALYSIS.md for detailed findings
3. Decide if you want to optimize filters (reduce 25k to 8k properties)
4. Monitor cache hits vs API calls in production
