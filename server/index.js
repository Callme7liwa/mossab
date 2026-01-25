import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import db from './db.js';
import authRoutes, { requireAuth } from './auth-routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Sync lock to prevent concurrent syncs
let syncInProgress = false;

app.use(cors());
app.use(express.json());

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Get properties with filters
app.get('/api/properties', (req, res) => {
  try {
    const { status, city, minPrice, maxPrice, minBeds, minBaths, limit = 1000 } = req.query;

    let sql = 'SELECT * FROM properties WHERE 1=1';
    const params = [];

    if (status) {
      // Handle multiple statuses (comma-separated)
      const statuses = status.split(',').map(s => s.trim());
      sql += ` AND status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }

    if (city && city !== 'All Towns') {
      sql += ' AND city = ?';
      params.push(city);
    }

    if (minPrice) {
      sql += ' AND price >= ?';
      params.push(parseInt(minPrice));
    }

    if (maxPrice) {
      sql += ' AND price <= ?';
      params.push(parseInt(maxPrice));
    }

    if (minBeds) {
      sql += ' AND beds >= ?';
      params.push(parseInt(minBeds));
    }

    if (minBaths) {
      sql += ' AND baths >= ?';
      params.push(parseFloat(minBaths));
    }

    sql += ' ORDER BY listDate DESC';
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    const properties = db.prepare(sql).all(...params);
    
    // Parse photos JSON for each property and add photosCount + calculate pricePerSqft
    const propertiesWithPhotos = properties.map(p => {
      const photos = p.photos ? JSON.parse(p.photos) : [];
      const pricePerSqft = (p.sqft && p.sqft > 0) ? Math.round(p.price / p.sqft) : 0;
      return {
        ...p,
        type: p.propertyType || 'Unknown', // Add type alias for frontend compatibility
        photos: photos,
        photosCount: photos.length,
        pricePerSqft: pricePerSqft
      };
    });
    
    res.json({
      count: propertiesWithPhotos.length,
      properties: propertiesWithPhotos
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single property by ID
app.get('/api/properties/:id', (req, res) => {
  try {
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Parse photos JSON and add photosCount + calculate pricePerSqft
    const photos = property.photos ? JSON.parse(property.photos) : [];
    const pricePerSqft = (property.sqft && property.sqft > 0) ? Math.round(property.price / property.sqft) : 0;
    const propertyWithPhotos = {
      ...property,
      type: property.propertyType || 'Unknown', // Add type alias for frontend compatibility
      photos: photos,
      photosCount: photos.length,
      pricePerSqft: pricePerSqft
    };

    res.json(propertyWithPhotos);
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get listing history for a property (all listings at same address)
app.get('/api/properties/:id/history', (req, res) => {
  try {
    // First get the property to find its addressKey
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (!property.addressKey) {
      return res.json({ property, history: [], hasMultipleListings: false });
    }

    // Find all listings with same addressKey
    const history = db.prepare(`
      SELECT * FROM properties 
      WHERE addressKey = ? 
      ORDER BY COALESCE(closeDate, listDate) DESC
    `).all(property.addressKey);

    res.json({
      property,
      history,
      hasMultipleListings: history.length > 1,
      listingCount: history.length
    });
  } catch (error) {
    console.error('Error fetching property history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get properties with multiple listings (potential flips, re-lists)
app.get('/api/analytics/multiple-listings', (req, res) => {
  try {
    const properties = db.prepare(`
      SELECT 
        addressKey,
        address,
        city,
        COUNT(*) as listingCount,
        MIN(listDate) as firstListDate,
        MAX(COALESCE(closeDate, listDate)) as lastActivity,
        GROUP_CONCAT(status) as statuses,
        MIN(CASE WHEN status = 'Closed' THEN closePrice END) as firstSalePrice,
        MAX(CASE WHEN status = 'Closed' THEN closePrice END) as lastSalePrice
      FROM properties
      WHERE addressKey IS NOT NULL
      GROUP BY addressKey
      HAVING COUNT(*) > 1
      ORDER BY listingCount DESC, lastActivity DESC
    `).all();

    // Calculate appreciation for properties sold multiple times
    const withAppreciation = properties.map(p => {
      let appreciation = null;
      if (p.firstSalePrice && p.lastSalePrice && p.firstSalePrice !== p.lastSalePrice) {
        appreciation = ((p.lastSalePrice - p.firstSalePrice) / p.firstSalePrice * 100).toFixed(1);
      }
      return { ...p, appreciation };
    });

    res.json({
      count: properties.length,
      properties: withAppreciation
    });
  } catch (error) {
    console.error('Error fetching multiple listings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get statistics summary
app.get('/api/stats', (req, res) => {
  try {
    const { status, city } = req.query;

    let whereClause = '1=1';
    const params = [];

    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      whereClause += ` AND status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }

    if (city && city !== 'All Towns') {
      whereClause += ' AND city = ?';
      params.push(city);
    }

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalCount,
        AVG(price) as avgPrice,
        AVG(dom) as avgDOM,
        AVG(CASE WHEN sqft > 0 THEN price / sqft END) as avgPricePerSqft,
        MIN(price) as minPrice,
        MAX(price) as maxPrice
      FROM properties
      WHERE ${whereClause}
    `).get(...params);

    // Get counts by status
    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM properties
      WHERE ${whereClause.replace(/AND status IN \([^)]+\)/g, '1=1')}
      GROUP BY status
    `).all(...params.filter((_, i) => i >= (status ? status.split(',').length : 0)));

    // Get counts by city
    const cityCounts = db.prepare(`
      SELECT city, COUNT(*) as count
      FROM properties
      WHERE ${whereClause}
      GROUP BY city
      ORDER BY count DESC
    `).all(...params);

    res.json({
      ...stats,
      statusCounts: Object.fromEntries(statusCounts.map(r => [r.status, r.count])),
      cityCounts: Object.fromEntries(cityCounts.map(r => [r.city, r.count]))
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get last sync info
app.get('/api/sync/status', (req, res) => {
  try {
    const lastSync = db.prepare(`
      SELECT * FROM sync_log 
      ORDER BY id DESC 
      LIMIT 1
    `).get();

    const totalProperties = db.prepare('SELECT COUNT(*) as count FROM properties').get();

    res.json({
      lastSync,
      totalProperties: totalProperties.count
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual sync (in background)
app.post('/api/sync', async (req, res) => {
  if (syncInProgress) {
    return res.status(409).json({ error: 'Sync already in progress. Please wait for it to complete.' });
  }

  try {
    const { strategy = 'upsert' } = req.body; // 'upsert' or 'replace'
    syncInProgress = true;
    console.log('\n🔒 Sync lock acquired');
    
    // Run sync in background
    const syncProcess = spawn('node', ['sync.js', strategy], {
      cwd: import.meta.dirname,
      detached: false,
      stdio: 'inherit' // Show logs in main terminal
    });

    // Release lock when process exits
    syncProcess.on('exit', (code) => {
      syncInProgress = false;
      console.log(`🔓 Sync lock released (exit code: ${code})\n`);
    });

    res.json({ message: `Full sync started in background (${strategy})`, type: 'full', strategy });
  } catch (error) {
    syncInProgress = false;
    console.error('Error starting sync:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger quick sync (active statuses only) - faster
app.post('/api/sync/quick', async (req, res) => {
  if (syncInProgress) {
    return res.status(409).json({ error: 'Sync already in progress. Please wait for it to complete.' });
  }

  try {
    const { strategy = 'upsert' } = req.body; // 'upsert' or 'replace'
    syncInProgress = true;
    console.log('\n🔒 Sync lock acquired');
    
    // Run quick sync in background
    const syncProcess = spawn('node', ['quick-sync.js', strategy], {
      cwd: import.meta.dirname,
      detached: false,
      stdio: 'inherit' // Show logs in main terminal
    });

    // Release lock when process exits
    syncProcess.on('exit', (code) => {
      syncInProgress = false;
      console.log(`🔓 Sync lock released (exit code: ${code})\n`);
    });

    res.json({ message: `Quick sync started in background (${strategy})`, type: 'quick', strategy });
  } catch (error) {
    syncInProgress = false;
    console.error('Error starting quick sync:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-sync check - runs quick sync if data is older than 6 hours
const AUTO_SYNC_THRESHOLD_HOURS = 6;

async function checkAndAutoSync() {
  try {
    const lastSync = db.prepare(`
      SELECT completed_at FROM sync_log 
      WHERE status = 'completed'
      ORDER BY id DESC 
      LIMIT 1
    `).get();

    if (!lastSync || !lastSync.completed_at) {
      console.log('⚠️  No sync history found - triggering initial sync...');
      triggerQuickSync();
      return;
    }

    const lastSyncTime = new Date(lastSync.completed_at);
    const hoursSinceSync = (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceSync > AUTO_SYNC_THRESHOLD_HOURS) {
      console.log(`⏰ Last sync was ${hoursSinceSync.toFixed(1)} hours ago (>${AUTO_SYNC_THRESHOLD_HOURS}h) - auto-syncing...`);
      triggerQuickSync();
    } else {
      console.log(`✓ Data is fresh (synced ${hoursSinceSync.toFixed(1)} hours ago)`);
    }
  } catch (error) {
    console.error('Error checking auto-sync:', error);
  }
}

async function triggerQuickSync() {
  try {
    const { spawn } = await import('child_process');
    const syncProcess = spawn('node', ['quick-sync.js'], {
      cwd: import.meta.dirname,
      detached: true,
      stdio: 'inherit' // Show sync output in console
    });
    syncProcess.unref();
  } catch (error) {
    console.error('Error triggering auto-sync:', error);
  }
}

app.listen(PORT, () => {
  console.log(`🏠 Aura Estates API running on http://localhost:${PORT}`);
  
  // Show database stats
  const stats = db.prepare('SELECT COUNT(*) as count FROM properties').get();
  console.log(`📊 Database contains ${stats.count} properties`);

  // Check if auto-sync is needed on startup
  checkAndAutoSync();
});
