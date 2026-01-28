import 'dotenv/config';
import db from './db.js';

const API_BASE = 'https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4';
const API_TOKEN = process.env.BRIDGE_API_TOKEN;

const TOWNS = ['Weston', 'Wellesley', 'Newton', 'Needham', 'Dover', 'Natick', 'Westwood'];
const cityFilter = TOWNS.map(t => `City eq '${t}'`).join(' or ');

// Property types we sync
const PROPERTY_TYPES = [
  { filter: "PropertySubType eq 'Single Family Residence'", name: 'Single Family Residence', dbField: 'Single Family Residence' },
  { filter: "PropertySubType eq 'Condominium'", name: 'Condominium', dbField: 'Condominium' },
  { filter: "PropertySubType eq 'Multi Family'", name: 'Multi Family', dbField: 'Multi Family' },
  { filter: "PropertyType eq 'Land'", name: 'Land', dbField: 'Land' },
];

// Statuses we sync
const STATUSES = ['Active', 'Pending', 'Active Under Contract', 'Withdrawn', 'Closed'];

async function getApiCount(filter) {
  const url = `${API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$top=1&$count=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${API_TOKEN}` }
  });
  const data = await response.json();
  return data['@odata.count'] || 0;
}

function getDbCount(where = '') {
  const sql = `SELECT COUNT(*) as c FROM properties ${where}`;
  return db.prepare(sql).get().c;
}

async function verify() {
  console.log('===========================================');
  console.log('VERIFICATION: Bridge API vs Local Database');
  console.log('===========================================\n');

  // Get current year for closed filter
  const currentYear = new Date().getFullYear();
  const fiveYearsAgo = currentYear - 5;

  console.log('📊 TOTALS BY PROPERTY TYPE:\n');
  console.log('Property Type'.padEnd(25) + 'API Count'.padEnd(12) + 'DB Count'.padEnd(12) + 'Match?');
  console.log('-'.repeat(55));

  for (const propType of PROPERTY_TYPES) {
    const apiFilter = `(${cityFilter}) and ${propType.filter}`;
    const apiCount = await getApiCount(apiFilter);
    const dbCount = getDbCount(`WHERE propertyType = '${propType.dbField}'`);
    const match = apiCount === dbCount ? '✅' : `❌ (diff: ${apiCount - dbCount})`;
    console.log(propType.name.padEnd(25) + String(apiCount).padEnd(12) + String(dbCount).padEnd(12) + match);
  }

  console.log('\n📊 TOTALS BY STATUS:\n');
  console.log('Status'.padEnd(25) + 'API Count'.padEnd(12) + 'DB Count'.padEnd(12) + 'Match?');
  console.log('-'.repeat(55));

  for (const status of STATUSES) {
    let apiFilter = `(${cityFilter}) and StandardStatus eq '${status}'`;
    
    // For Closed, only count last 5 years (what we sync)
    if (status === 'Closed') {
      apiFilter += ` and CloseDate ge ${fiveYearsAgo}-01-01`;
    }
    
    // Apply property type filter to match what we sync
    const propTypeFilters = PROPERTY_TYPES.map(p => p.filter).join(' or ');
    apiFilter += ` and (${propTypeFilters})`;
    
    const apiCount = await getApiCount(apiFilter);
    const dbCount = getDbCount(`WHERE status = '${status}'`);
    const match = apiCount === dbCount ? '✅' : `❌ (diff: ${apiCount - dbCount})`;
    console.log(status.padEnd(25) + String(apiCount).padEnd(12) + String(dbCount).padEnd(12) + match);
  }

  console.log('\n📊 TOTALS BY TOWN:\n');
  console.log('Town'.padEnd(20) + 'DB Count');
  console.log('-'.repeat(30));

  for (const town of TOWNS) {
    const dbCount = getDbCount(`WHERE city = '${town}'`);
    console.log(town.padEnd(20) + dbCount);
  }

  // Overall total
  const totalDb = getDbCount();
  console.log('\n===========================================');
  console.log(`TOTAL IN DATABASE: ${totalDb.toLocaleString()} properties`);
  console.log('===========================================\n');
}

verify().catch(console.error);
