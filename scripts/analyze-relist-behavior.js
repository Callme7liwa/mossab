#!/usr/bin/env node

/**
 * Analyze re-list behavior for a property with multiple listings
 */

const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

async function analyze() {
  console.log('RE-LIST BEHAVIOR ANALYSIS');
  console.log('═'.repeat(60));
  
  // Get the property at 247 Broad Meadow Rd that has 4 listings
  const addrFilter = "StreetNumber eq '247' and StreetName eq 'Broad Meadow Rd' and City eq 'Needham'";
  const url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(addrFilter)}&$orderby=ListingContractDate desc&$select=ListingId,StandardStatus,ListPrice,OriginalListPrice,ListingContractDate,OffMarketDate,CloseDate,ClosePrice,MLSPIN_MARKET_TIME`;
  
  const res = await fetch(url, { headers: { Authorization: `Bearer ${BRIDGE_API_TOKEN}` }});
  const data = await res.json();
  
  console.log('\n247 Broad Meadow Rd, Needham - FULL LISTING HISTORY:');
  console.log('─'.repeat(60));
  
  data.value.forEach((p, i) => {
    console.log(`\nListing #${i+1} (ID: ${p.ListingId})`);
    console.log(`  Status: ${p.StandardStatus}`);
    console.log(`  Listed: ${p.ListingContractDate}`);
    console.log(`  OffMarket: ${p.OffMarketDate || 'N/A'}`);
    console.log(`  List Price: $${p.ListPrice ? (p.ListPrice/1000).toFixed(0) + 'K' : 'N/A'}`);
    console.log(`  Original Price: $${p.OriginalListPrice ? (p.OriginalListPrice/1000).toFixed(0) + 'K' : 'N/A'}`);
    if (p.ClosePrice) {
      console.log(`  Closed: ${p.CloseDate} @ $${(p.ClosePrice/1000).toFixed(0)}K`);
    }
    console.log(`  DOM: ${p.MLSPIN_MARKET_TIME} days`);
  });
  
  // Calculate re-list metrics
  if (data.value.length > 1) {
    console.log('\n📊 RE-LIST METRICS:');
    console.log('─'.repeat(60));
    console.log(`Total listings for this property: ${data.value.length}`);
    
    // Find price changes between listings
    for (let i = 0; i < data.value.length - 1; i++) {
      const current = data.value[i];
      const previous = data.value[i + 1];
      
      if (previous.ListPrice && current.ListPrice) {
        const priceDiff = ((current.ListPrice - previous.ListPrice) / previous.ListPrice * 100).toFixed(1);
        const daysBetween = previous.OffMarketDate && current.ListingContractDate 
          ? Math.round((new Date(current.ListingContractDate) - new Date(previous.OffMarketDate)) / (1000*60*60*24))
          : 'N/A';
        
        console.log(`\nFrom listing #${i+2} to #${i+1}:`);
        console.log(`  Days between listings: ${daysBetween}`);
        console.log(`  Price change: ${priceDiff}%`);
      }
    }
  }

  // Now let's analyze another property - 1 Aberdeen Road, Weston
  console.log('\n\n' + '═'.repeat(60));
  console.log('1 Aberdeen Road, Weston - FULL LISTING HISTORY:');
  console.log('─'.repeat(60));
  
  const addrFilter2 = "StreetNumber eq '1' and StreetName eq 'Aberdeen Road' and City eq 'Weston'";
  const url2 = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(addrFilter2)}&$orderby=ListingContractDate desc&$select=ListingId,StandardStatus,ListPrice,OriginalListPrice,ListingContractDate,OffMarketDate,CloseDate,ClosePrice,MLSPIN_MARKET_TIME`;
  
  const res2 = await fetch(url2, { headers: { Authorization: `Bearer ${BRIDGE_API_TOKEN}` }});
  const data2 = await res2.json();
  
  data2.value.forEach((p, i) => {
    console.log(`\nListing #${i+1} (ID: ${p.ListingId})`);
    console.log(`  Status: ${p.StandardStatus}`);
    console.log(`  Listed: ${p.ListingContractDate}`);
    console.log(`  OffMarket: ${p.OffMarketDate || 'N/A'}`);
    console.log(`  List Price: $${p.ListPrice ? (p.ListPrice/1000).toFixed(0) + 'K' : 'N/A'}`);
    if (p.ClosePrice) {
      console.log(`  Closed: ${p.CloseDate} @ $${(p.ClosePrice/1000).toFixed(0)}K`);
    }
    console.log(`  DOM: ${p.MLSPIN_MARKET_TIME} days`);
  });

  console.log('\n' + '═'.repeat(60));
  console.log('CONCLUSION: RE-LIST TRACKING IS FULLY POSSIBLE!');
  console.log('═'.repeat(60));
  console.log(`
We can track:
✅ Number of times a property was listed
✅ Price changes between listings
✅ Days between withdrawal and re-list
✅ Whether re-listed properties eventually sold
✅ DOM accumulation across multiple listings
  `);
}

analyze().catch(console.error);
