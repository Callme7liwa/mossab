import db from './db.js';

const API_BASE = 'https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4';
const API_TOKEN = '725919c8f3653746355154239821a3b1';

const TOWNS = ['Weston', 'Wellesley', 'Newton', 'Needham', 'Dover', 'Natick', 'Westwood'];
const NON_CLOSED_STATUSES = ['Active', 'Pending', 'Active Under Contract', 'Withdrawn'];
const CLOSED_YEARS_TO_SYNC = 5;

async function fetchCountFromBridge(filter) {
  const params = new URLSearchParams({
    '$filter': filter,
    '$top': 1,
    '$count': 'true',
  });

  const url = `${API_BASE}/Property?${params}`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${API_TOKEN}` }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data['@odata.count'] || 0;
}

async function verifySync() {
  console.log('\n========================================');
  console.log('🔍 SYNC VERIFICATION STARTED');
  console.log('========================================\n');

  const baseFilter = `PropertyType eq 'Residential' and PropertySubType eq 'Single Family Residence'`;
  const cityFilter = TOWNS.map(t => `City eq '${t}'`).join(' or ');

  const results = {
    api: {},
    db: {},
    match: true
  };

  // Verify non-closed statuses
  console.log('📊 Checking Active Statuses...\n');
  
  for (const status of NON_CLOSED_STATUSES) {
    const filter = `StandardStatus eq '${status}' and (${cityFilter}) and ${baseFilter}`;
    
    // Get count from API
    const apiCount = await fetchCountFromBridge(filter);
    
    // Get count from DB
    const dbResult = db.prepare('SELECT COUNT(*) as count FROM properties WHERE status = ?').get(status);
    const dbCount = dbResult.count;
    
    results.api[status] = apiCount;
    results.db[status] = dbCount;
    
    const match = apiCount === dbCount;
    if (!match) results.match = false;
    
    const icon = match ? '✅' : '❌';
    console.log(`${icon} ${status}:`);
    console.log(`   Bridge API: ${apiCount.toLocaleString()}`);
    console.log(`   Database:   ${dbCount.toLocaleString()}`);
    if (!match) {
      console.log(`   ⚠️  Difference: ${Math.abs(apiCount - dbCount)}`);
    }
    console.log('');
    
    await new Promise(r => setTimeout(r, 100));
  }

  // Verify closed sales by year
  console.log('📊 Checking Closed Sales (Last 5 Years)...\n');
  
  const currentYear = new Date().getFullYear();
  for (let year = currentYear; year >= currentYear - CLOSED_YEARS_TO_SYNC; year--) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const filter = `StandardStatus eq 'Closed' and (${cityFilter}) and ${baseFilter} and CloseDate ge ${startDate} and CloseDate le ${endDate}`;
    
    // Get count from API
    const apiCount = await fetchCountFromBridge(filter);
    
    // Get count from DB
    const dbResult = db.prepare(`
      SELECT COUNT(*) as count FROM properties 
      WHERE status = 'Closed' 
      AND closeDate >= ? 
      AND closeDate <= ?
    `).get(`${year}-01-01`, `${year}-12-31`);
    const dbCount = dbResult.count;
    
    results.api[`Closed ${year}`] = apiCount;
    results.db[`Closed ${year}`] = dbCount;
    
    const match = apiCount === dbCount;
    if (!match) results.match = false;
    
    const icon = match ? '✅' : '❌';
    console.log(`${icon} Closed ${year}:`);
    console.log(`   Bridge API: ${apiCount.toLocaleString()}`);
    console.log(`   Database:   ${dbCount.toLocaleString()}`);
    if (!match) {
      console.log(`   ⚠️  Difference: ${Math.abs(apiCount - dbCount)}`);
    }
    console.log('');
    
    await new Promise(r => setTimeout(r, 100));
  }

  // Calculate totals
  const totalApi = Object.values(results.api).reduce((sum, count) => sum + count, 0);
  const totalDb = db.prepare('SELECT COUNT(*) as count FROM properties').get().count;
  
  console.log('========================================');
  console.log('📈 TOTALS:');
  console.log(`   Bridge API: ${totalApi.toLocaleString()} properties`);
  console.log(`   Database:   ${totalDb.toLocaleString()} properties`);
  
  if (totalApi === totalDb) {
    console.log('\n✅ VERIFICATION PASSED!');
    console.log('   Database is perfectly synced with Bridge API');
  } else {
    console.log('\n❌ VERIFICATION FAILED!');
    console.log(`   Difference: ${Math.abs(totalApi - totalDb)} properties`);
    if (totalDb < totalApi) {
      console.log('   Database is missing some properties');
    } else {
      console.log('   Database has extra properties (old listings?)');
    }
  }
  console.log('========================================\n');

  // Additional diagnostics
  console.log('🔍 Additional Diagnostics:\n');
  
  // Check for properties with unknown status
  const unknownStatus = db.prepare("SELECT COUNT(*) as count FROM properties WHERE status NOT IN ('Active', 'Pending', 'Active Under Contract', 'Withdrawn', 'Closed')").get();
  if (unknownStatus.count > 0) {
    console.log(`⚠️  Found ${unknownStatus.count} properties with unknown status`);
  }
  
  // Check properties by city
  console.log('Properties by city (Database):');
  const cityCounts = db.prepare('SELECT city, COUNT(*) as count FROM properties GROUP BY city ORDER BY count DESC').all();
  cityCounts.forEach(row => {
    console.log(`   ${row.city}: ${row.count.toLocaleString()}`);
  });
  
  console.log('\n');
  
  return results.match;
}

verifySync().then((success) => {
  process.exit(success ? 0 : 1);
}).catch((err) => {
  console.error('\n❌ Verification failed with error:', err.message);
  process.exit(1);
});
