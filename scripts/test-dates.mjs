// Test what date fields are available for Closed properties
const BRIDGE_API_BASE = 'https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4';
const BRIDGE_API_TOKEN = '725919c8f3653746355154239821a3b1';

const towns = ['Weston', 'Wellesley', 'Newton', 'Needham', 'Dover', 'Natick', 'Westwood'];
const townFilter = towns.map(t => `City eq '${t}'`).join(' or ');
const filter = `StandardStatus eq 'Closed' and (${townFilter})`;

const params = new URLSearchParams();
params.set('$top', '5');
params.set('$filter', filter);
params.set('$orderby', 'ModificationTimestamp desc');  // Most recent first
params.set('$select', 'UnparsedAddress,StandardStatus,ListPrice,ClosePrice,OffMarketDate,ListingContractDate,CloseDate,StatusChangeTimestamp');

const url = `${BRIDGE_API_BASE}/Property?${params.toString()}`;
console.log('Fetching most recent Closed properties...\n');

const response = await fetch(url, {
  headers: { Authorization: `Bearer ${BRIDGE_API_TOKEN}` }
});
const data = await response.json();

console.log('Most Recent Closed properties:\n');
data.value.forEach((p, i) => {
  console.log(`${i+1}. ${p.UnparsedAddress || 'No address'}`);
  console.log(`   CloseDate: ${p.CloseDate}`);
  console.log(`   ClosePrice: $${p.ClosePrice?.toLocaleString()}`);
  console.log(`   OffMarketDate: ${p.OffMarketDate}`);
  console.log();
});
