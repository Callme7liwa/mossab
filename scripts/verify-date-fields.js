#!/usr/bin/env node

/**
 * Verify ListingContractDate availability
 * Discovered: OnMarketDate, DaysOnMarket, CumulativeDaysOnMarket don't exist
 * Available: ListingContractDate, OffMarketDate, MLSPIN_MARKET_TIME, etc.
 */

const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

const TOWNS = ["Weston", "Wellesley", "Newton", "Needham", "Dover", "Natick", "Westwood"];
const cityFilter = TOWNS.map(town => `City eq '${town}'`).join(" or ");

async function fetchAPI(filter, select, top = 10, orderby = null) {
  let url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}`;
  if (select) url += `&$select=${select}`;
  url += `&$top=${top}`;
  if (orderby) url += `&$orderby=${orderby}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
      "Accept": "application/json"
    }
  });
  
  if (!response.ok) {
    const text = await response.text();
    console.log('Error Response:', text);
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

async function countWithField(baseFilter, fieldName) {
  const filter = `${baseFilter} and ${fieldName} ne null`;
  const url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$count=true&$top=0`;
  
  const response = await fetch(url, {
    headers: { "Authorization": `Bearer ${BRIDGE_API_TOKEN}` }
  });
  const data = await response.json();
  return data["@odata.count"] || 0;
}

async function verifyDateFields() {
  console.log('═'.repeat(70));
  console.log('VERIFYING DATE FIELDS IN MLSPIN');
  console.log('═'.repeat(70));

  const baseFilter = `(${cityFilter}) and PropertySubType eq 'Single Family Residence'`;
  
  // Available fields discovered via API exploration
  const select = 'ListingId,City,ListingContractDate,OffMarketDate,MLSPIN_MARKET_TIME,StatusChangeTimestamp,ModificationTimestamp,ListPrice';

  // Test 1: Active properties
  console.log('\n📅 TEST 1: ACTIVE properties sample');
  console.log('─'.repeat(50));
  
  let filter = `${baseFilter} and StandardStatus eq 'Active'`;
  let data = await fetchAPI(filter, select, 12);
  
  let hasLCD = 0, hasOMD = 0, hasMT = 0;
  
  console.log('\nSample Active Properties:');
  data.value.forEach((p, i) => {
    if (p.ListingContractDate) hasLCD++;
    if (p.OffMarketDate) hasOMD++;
    if (p.MLSPIN_MARKET_TIME !== null && p.MLSPIN_MARKET_TIME !== undefined) hasMT++;
    
    console.log(`\n  ${i+1}. ${p.City} - $${(p.ListPrice/1000).toFixed(0)}K`);
    console.log(`     ListingContractDate:   ${p.ListingContractDate || '❌ EMPTY'}`);
    console.log(`     OffMarketDate:         ${p.OffMarketDate || '❌ EMPTY'}`);
    console.log(`     MLSPIN_MARKET_TIME:    ${p.MLSPIN_MARKET_TIME ?? '❌ EMPTY'} days`);
  });
  
  console.log(`\n✅ Active Summary (${data.value.length} sampled):`);
  console.log(`   ListingContractDate:   ${hasLCD}/${data.value.length} (${Math.round(hasLCD/data.value.length*100)}%)`);
  console.log(`   OffMarketDate:         ${hasOMD}/${data.value.length} (${Math.round(hasOMD/data.value.length*100)}%)`);
  console.log(`   MLSPIN_MARKET_TIME:    ${hasMT}/${data.value.length} (${Math.round(hasMT/data.value.length*100)}%)`);

  // Test 2: Pending properties
  console.log('\n📅 TEST 2: PENDING properties sample');
  console.log('─'.repeat(50));
  
  filter = `${baseFilter} and StandardStatus eq 'Pending'`;
  data = await fetchAPI(filter, select, 12);
  
  hasLCD = 0; hasOMD = 0; hasMT = 0;
  
  console.log('\nSample Pending Properties:');
  data.value.forEach((p, i) => {
    if (p.ListingContractDate) hasLCD++;
    if (p.OffMarketDate) hasOMD++;
    if (p.MLSPIN_MARKET_TIME !== null && p.MLSPIN_MARKET_TIME !== undefined) hasMT++;
    
    console.log(`\n  ${i+1}. ${p.City} - $${(p.ListPrice/1000).toFixed(0)}K`);
    console.log(`     ListingContractDate:   ${p.ListingContractDate || '❌ EMPTY'}`);
    console.log(`     OffMarketDate:         ${p.OffMarketDate || '❌ EMPTY'}`);
    console.log(`     MLSPIN_MARKET_TIME:    ${p.MLSPIN_MARKET_TIME ?? '❌ EMPTY'} days`);
  });
  
  console.log(`\n✅ Pending Summary (${data.value.length} sampled):`);
  console.log(`   ListingContractDate:   ${hasLCD}/${data.value.length} (${Math.round(hasLCD/data.value.length*100)}%)`);
  console.log(`   OffMarketDate:         ${hasOMD}/${data.value.length} (${Math.round(hasOMD/data.value.length*100)}%)`);
  console.log(`   MLSPIN_MARKET_TIME:    ${hasMT}/${data.value.length} (${Math.round(hasMT/data.value.length*100)}%)`);

  // Test 3: Closed (Sold) properties
  console.log('\n📅 TEST 3: CLOSED (Sold) properties sample');
  console.log('─'.repeat(50));
  
  filter = `${baseFilter} and StandardStatus eq 'Closed'`;
  const selectClosed = 'ListingId,City,ListingContractDate,OffMarketDate,MLSPIN_MARKET_TIME,CloseDate,ClosePrice';
  data = await fetchAPI(filter, selectClosed, 12, 'CloseDate desc');
  
  hasLCD = 0; hasOMD = 0; hasMT = 0;
  
  console.log('\nSample Closed Properties (recent):');
  data.value.forEach((p, i) => {
    if (p.ListingContractDate) hasLCD++;
    if (p.OffMarketDate) hasOMD++;
    if (p.MLSPIN_MARKET_TIME !== null && p.MLSPIN_MARKET_TIME !== undefined) hasMT++;
    
    const price = p.ClosePrice ? `$${(p.ClosePrice/1000).toFixed(0)}K` : 'N/A';
    console.log(`\n  ${i+1}. ${p.City} - Closed ${p.CloseDate?.substring(0,10)} @ ${price}`);
    console.log(`     ListingContractDate:   ${p.ListingContractDate || '❌ EMPTY'}`);
    console.log(`     OffMarketDate:         ${p.OffMarketDate || '❌ EMPTY'}`);
    console.log(`     MLSPIN_MARKET_TIME:    ${p.MLSPIN_MARKET_TIME ?? '❌ EMPTY'} days`);
  });
  
  console.log(`\n✅ Closed Summary (${data.value.length} sampled):`);
  console.log(`   ListingContractDate:   ${hasLCD}/${data.value.length} (${Math.round(hasLCD/data.value.length*100)}%)`);
  console.log(`   OffMarketDate:         ${hasOMD}/${data.value.length} (${Math.round(hasOMD/data.value.length*100)}%)`);
  console.log(`   MLSPIN_MARKET_TIME:    ${hasMT}/${data.value.length} (${Math.round(hasMT/data.value.length*100)}%)`);

  // Test 4: Count totals across all properties
  console.log('\n📊 TEST 4: Total counts with each date field (all statuses)');
  console.log('─'.repeat(50));
  
  const totalLCD = await countWithField(baseFilter, 'ListingContractDate');
  console.log(`  Properties with ListingContractDate:   ${totalLCD.toLocaleString()}`);
  
  const totalOMD = await countWithField(baseFilter, 'OffMarketDate');
  console.log(`  Properties with OffMarketDate:         ${totalOMD.toLocaleString()}`);
  
  const totalMT = await countWithField(baseFilter, 'MLSPIN_MARKET_TIME');
  console.log(`  Properties with MLSPIN_MARKET_TIME:    ${totalMT.toLocaleString()}`);
  
  // Get total count
  const totalUrl = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(baseFilter)}&$count=true&$top=0`;
  const totalRes = await fetch(totalUrl, { headers: { "Authorization": `Bearer ${BRIDGE_API_TOKEN}` }});
  const totalData = await totalRes.json();
  const totalCount = totalData["@odata.count"] || 0;
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  Total Single Family in 7 towns:         ${totalCount.toLocaleString()}`);

  console.log('\n' + '═'.repeat(70));
  console.log('VERIFICATION COMPLETE - SUMMARY');
  console.log('═'.repeat(70));
  console.log(`
┌────────────────────────────────┬──────────────┬───────────────────────┐
│ Field                          │ Populated    │ Status                │
├────────────────────────────────┼──────────────┼───────────────────────┤
│ ListingContractDate            │ ${String(totalLCD).padStart(10)}   │ ${totalLCD > 0 ? '✅ AVAILABLE' : '❌ MISSING'}           │
│ OffMarketDate                  │ ${String(totalOMD).padStart(10)}   │ ${totalOMD > 0 ? '✅ AVAILABLE' : '❌ MISSING'}           │
│ MLSPIN_MARKET_TIME (days)      │ ${String(totalMT).padStart(10)}   │ ${totalMT > 0 ? '✅ AVAILABLE' : '❌ MISSING'}           │
│ OnMarketDate                   │        N/A   │ ❌ FIELD NOT IN API   │
│ DaysOnMarket                   │        N/A   │ ❌ FIELD NOT IN API   │
│ CumulativeDaysOnMarket         │        N/A   │ ❌ FIELD NOT IN API   │
└────────────────────────────────┴──────────────┴───────────────────────┘

📝 KEY FINDINGS:
   • ListingContractDate ✅ = When listing agreement was signed (listing start)
   • MLSPIN_MARKET_TIME ✅  = Days on market (calculated by MLS)
   • OffMarketDate ✅       = When property went off market
   
   • OnMarketDate ❌        = Does NOT exist in MLSPIN feed
   • DaysOnMarket ❌        = Does NOT exist (use MLSPIN_MARKET_TIME instead)

💡 For time-to-pending calculations, use:
   - ListingContractDate as the listing start date
   - MLSPIN_MARKET_TIME for days on market
`);
}

verifyDateFields().catch(console.error);
