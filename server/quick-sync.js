import db from './db.js';

// Quick sync - only Active/Pending/Under Contract/Withdrawn
// Much faster than full sync since we skip historical Closed data

// Get strategy from command line argument (default: upsert)
const strategy = process.argv[2] || 'upsert';

const API_BASE = 'https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4';
const API_TOKEN = process.env.BRIDGE_API_TOKEN || (() => { throw new Error('BRIDGE_API_TOKEN environment variable not set'); })();

const TOWNS = ['Weston', 'Wellesley', 'Newton', 'Needham', 'Dover', 'Natick', 'Westwood'];
const ACTIVE_STATUSES = ['Active', 'Pending', 'Active Under Contract', 'Withdrawn'];
const PAGE_SIZE = 200;

// Generate a normalized address key for grouping multiple listings of same property
function generateAddressKey(prop) {
  const streetNum = (prop.StreetNumber || '').toString().trim();
  const streetName = (prop.StreetName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const city = (prop.City || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  const zip = (prop.PostalCode || '').toString().trim().slice(0, 5);
  return `${streetNum}-${streetName}-${city}-${zip}`;
}

function transformProperty(prop) {
  return {
    id: prop.ListingId || prop.ListingKey,
    mlsId: prop.ListingId,
    address: `${prop.StreetNumber || ''} ${prop.StreetName || ''} ${prop.StreetSuffix || ''}, ${prop.City || ''} ${prop.StateOrProvince || ''} ${prop.PostalCode || ''}`.trim(),
    addressKey: generateAddressKey(prop),
    city: prop.City,
    neighborhood: prop.City,
    price: prop.ListPrice || 0,
    originalPrice: prop.OriginalListPrice || prop.ListPrice || 0,
    closePrice: prop.ClosePrice || null,
    beds: prop.BedroomsTotal || 0,
    baths: (prop.BathroomsFull || 0) + (prop.BathroomsHalf || 0) * 0.5,
    sqft: prop.LivingArea || 0,
    lotSize: prop.LotSizeAcres || (prop.LotSizeSquareFeet ? prop.LotSizeSquareFeet / 43560 : 0),
    yearBuilt: prop.YearBuilt || null,
    propertyType: prop.PropertySubType || prop.PropertyType || 'Unknown',
    status: prop.StandardStatus,
    dom: prop.DaysOnMarket || prop.MLSPIN_MARKET_TIME || 0,
    listDate: prop.ListingContractDate || prop.OnMarketDate || null,
    offMarketDate: prop.OffMarketDate || null,
    closeDate: prop.CloseDate || null,
    latitude: prop.Latitude || null,
    longitude: prop.Longitude || null,
    photoUrl: prop.Media?.[0]?.MediaURL || null,
    photos: prop.Media ? JSON.stringify(prop.Media.map(m => ({ MediaURL: m.MediaURL, MediaType: m.MediaType }))) : null,
    prevMarketTime: prop.MLSPIN_PREV_MARKET_TIME || prop.PreviousListingMarketTime || null,
  };
}

async function fetchFromBridge(filter, skip = 0) {
  const params = new URLSearchParams({
    '$filter': filter,
    '$top': PAGE_SIZE.toString(),
    '$skip': skip.toString(),
    '$count': 'true',
    '$orderby': 'ListingContractDate desc',
  });

  const url = `${API_BASE}/Property?${params}`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${API_TOKEN}` }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function getUpsertStatement() {
  return db.prepare(`
    INSERT INTO properties (
      id, mlsId, address, addressKey, city, neighborhood, price, originalPrice, closePrice,
      beds, baths, sqft, lotSize, yearBuilt, propertyType, status, dom,
      listDate, offMarketDate, closeDate, latitude, longitude, photoUrl, photos, prevMarketTime, updated_at
    ) VALUES (
      @id, @mlsId, @address, @addressKey, @city, @neighborhood, @price, @originalPrice, @closePrice,
      @beds, @baths, @sqft, @lotSize, @yearBuilt, @propertyType, @status, @dom,
      @listDate, @offMarketDate, @closeDate, @latitude, @longitude, @photoUrl, @photos, @prevMarketTime, CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      mlsId = @mlsId,
      address = @address,
      addressKey = @addressKey,
      city = @city,
      neighborhood = @neighborhood,
      price = @price,
      originalPrice = @originalPrice,
      closePrice = @closePrice,
      beds = @beds,
      baths = @baths,
      sqft = @sqft,
      lotSize = @lotSize,
      yearBuilt = @yearBuilt,
      propertyType = @propertyType,
      status = @status,
      dom = @dom,
      listDate = @listDate,
      offMarketDate = @offMarketDate,
      closeDate = @closeDate,
      latitude = @latitude,
      longitude = @longitude,
      photoUrl = @photoUrl,
      photos = @photos,
      prevMarketTime = @prevMarketTime,
      updated_at = CURRENT_TIMESTAMP
  `);
}

async function quickSync() {
  console.log('\n========================================');
  console.log(`QUICK SYNC STARTED (Strategy: ${strategy.toUpperCase()})`);
  console.log('========================================\n');
  const startTime = Date.now();

  // Show current database state
  const beforeCount = db.prepare('SELECT COUNT(*) as count FROM properties').get();
  console.log(`📊 Current database state: ${beforeCount.count.toLocaleString()} properties\n`);

  // If replace strategy, delete all existing data first
  if (strategy === 'replace') {
    console.log('⚠️  REPLACE STRATEGY: Deleting all existing properties...');
    db.prepare('DELETE FROM properties').run();
    const afterDeleteCount = db.prepare('SELECT COUNT(*) as count FROM properties').get();
    console.log(`✓ Database cleared. Properties count: ${afterDeleteCount.count}\n`);
  } else {
    console.log('🔄 UPSERT STRATEGY: Updating existing properties, inserting new ones\n');
  }
  
  const baseFilter = `PropertyType eq 'Residential' and PropertySubType eq 'Single Family Residence'`;
  const cityFilter = TOWNS.map(t => `City eq '${t}'`).join(' or ');
  const upsert = getUpsertStatement();
  
  let totalSynced = 0;

  for (const status of ACTIVE_STATUSES) {
    console.log(`📡 Fetching ${status} properties from Bridge API...`);
    const filter = `StandardStatus eq '${status}' and (${cityFilter}) and ${baseFilter}`;
    
    let skip = 0;
    let statusCount = 0;
    let hasMore = true;

    while (hasMore) {
      const data = await fetchFromBridge(filter, skip);
      const properties = data.value || [];
      
      if (properties.length === 0) {
        hasMore = false;
        break;
      }

      const insertMany = db.transaction((props) => {
        for (const prop of props) {
          upsert.run(transformProperty(prop));
        }
      });

      insertMany(properties);
      statusCount += properties.length;
      console.log(`   ↳ Processed ${statusCount} properties...`);

      if (properties.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        skip += PAGE_SIZE;
        await new Promise(r => setTimeout(r, 50));
      }
    }

    console.log(`   ✓ ${status}: ${statusCount} properties synced\n`);
    totalSynced += statusCount;
  }

  // Log sync
  db.prepare(`
    INSERT INTO sync_log (status, started_at, completed_at, properties_synced)
    VALUES ('completed', ?, ?, ?)
  `).run(
    new Date(startTime).toISOString(),
    new Date().toISOString(),
    totalSynced
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const finalCount = db.prepare('SELECT COUNT(*) as count FROM properties').get();
  
  console.log('========================================');
  console.log('✅ QUICK SYNC COMPLETED!');
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log(`📊 Properties synced from API: ${totalSynced.toLocaleString()}`);
  console.log(`💾 Total properties in database: ${finalCount.count.toLocaleString()}`);
  console.log('========================================\n');
  
  return totalSynced;
}

quickSync().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Quick sync failed:', err.message);
  process.exit(1);
});
