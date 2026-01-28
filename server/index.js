import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import db from './db.js';
import authRoutes, { requireAuth, requireAdmin } from './auth-routes.js';
import permitsRoutes from './permits.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Sync lock to prevent concurrent syncs
let syncInProgress = false;

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8080';
app.use(cors({ origin: [CORS_ORIGIN, 'http://localhost:5173', 'http://localhost:3000', 'https://estate.intellisoft.software'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Permits / New Construction routes (protected)
app.use('/api/permits', requireAuth, permitsRoutes);

// Get properties with filters
app.get('/api/properties', requireAuth, (req, res) => {
  try {
    const { status, city, minPrice, maxPrice, minBeds, minBaths, limit = 1000, search, propertyType, timeframe } = req.query;

    let sql = 'SELECT * FROM properties WHERE 1=1';
    const params = [];

    // Search by address or MLS ID
    if (search) {
      sql += ' AND (address LIKE ? OR mlsId LIKE ? OR id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (status) {
      // Handle multiple statuses (comma-separated string or array)
      let statuses;
      if (Array.isArray(status)) {
        statuses = status;
      } else {
        statuses = status.split(',').map(s => s.trim());
      }
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

    if (propertyType && propertyType !== 'All') {
      sql += ' AND propertyType = ?';
      params.push(propertyType);
    }
    
    if (timeframe) {
      // timeframe expected like '3m','6m','12m','24m'
      const months = parseInt(timeframe.replace(/[^0-9]/g, '')) || 12;
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      const cutoffIso = cutoff.toISOString().slice(0,10);
      // Use listDate or closeDate as activity date
      sql += ` AND (COALESCE(listDate, closeDate) >= ?)`;
      params.push(cutoffIso);
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
app.get('/api/properties/:id', requireAuth, (req, res) => {
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
app.get('/api/properties/:id/history', requireAuth, (req, res) => {
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
app.get('/api/analytics/multiple-listings', requireAuth, requireAdmin, (req, res) => {
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

// Get enhanced KPIs with median calculations and advanced metrics
app.get('/api/kpis', requireAuth, (req, res) => {
  try {
    const { status = 'Active', city, propertyType, timeframe } = req.query;

    let sql = 'SELECT * FROM properties WHERE 1=1';
    const params = [];

    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      sql += ` AND status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }

    if (city && city !== 'All') {
      sql += ' AND city = ?';
      params.push(city);
    }

    if (propertyType && propertyType !== 'All') {
      sql += ' AND propertyType = ?';
      params.push(propertyType);
    }

    if (timeframe) {
      const months = parseInt(timeframe.replace(/[^0-9]/g, '')) || 12;
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      const cutoffIso = cutoff.toISOString().slice(0,10);
      sql += ` AND (COALESCE(listDate, closeDate) >= ?)`;
      params.push(cutoffIso);
    }

    const properties = db.prepare(sql).all(...params);
    const validProperties = properties.filter(p => p.price > 0);

    // Helper function to calculate median
    const getMedian = (arr) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    };

    // Calculate primary KPIs
    const prices = validProperties.map(p => p.price);
    const pricePerSqft = validProperties.map(p => p.price / (p.sqft || 1)).filter(v => !isNaN(v) && isFinite(v));
    const pricePerLot = validProperties.map(p => p.price / (p.lotSize || 1)).filter(v => !isNaN(v) && isFinite(v));
    const doms = validProperties.map(p => p.dom || 0).filter(d => d >= 0);

    // Calculate secondary KPIs (last 30 days)
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const last30DaysIso = last30Days.toISOString().slice(0,10);
    
    const newListings = properties.filter(p => p.listDate >= last30DaysIso).length;
    const soldProperties = properties.filter(p => p.status === 'Closed');
    const soldDOM = soldProperties.map(p => p.dom || 0).filter(d => d >= 0);

    // Calculate price reductions (simplified - properties with DOM > 60 days)
    const priceReductions = validProperties.filter(p => (p.dom || 0) > 60).length;
    const priceReductionPercent = validProperties.length > 0 ? (priceReductions / validProperties.length * 100) : 0;

    const kpis = {
      // Primary KPIs
      medianListingPrice: Math.round(getMedian(prices)),
      pricePerLivingAreaSqft: Math.round(getMedian(pricePerSqft)),
      pricePerLotSqft: Math.round(getMedian(pricePerLot)),
      activeInventory: validProperties.length,
      avgDaysOnMarket: Math.round(getMedian(doms)),
      
      // Secondary KPIs  
      newListings30Days: newListings,
      absorptionRate: soldProperties.length / (validProperties.length || 1) * 100,
      priceReductionPercent: Math.round(priceReductionPercent),
      medianDOMSold: Math.round(getMedian(soldDOM)),
      
      // Additional context
      totalProperties: properties.length,
      filters: { status, city, propertyType, timeframe }
    };

    res.json(kpis);
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get statistics summary
app.get('/api/stats', requireAuth, requireAdmin, (req, res) => {
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

// Trigger manual sync (in background) - admin only
app.post('/api/sync', requireAuth, requireAdmin, async (req, res) => {
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

// Trigger quick sync (active statuses only) - faster (admin only)
app.post('/api/sync/quick', requireAuth, requireAdmin, async (req, res) => {
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

// Trigger permit sync from Wellesley archive (admin only)
let permitSyncInProgress = false;

app.post('/api/sync/permits', requireAuth, requireAdmin, async (req, res) => {
  if (permitSyncInProgress) {
    return res.status(409).json({ error: 'Permit sync already in progress. Please wait for it to complete.' });
  }

  try {
    const { download = true, parse = true, link = true } = req.body;
    permitSyncInProgress = true;
    console.log('\n🔒 Permit sync lock acquired');
    
    // Build arguments based on options
    const args = ['permit-sync-v2.js'];
    if (download) args.push('--download');
    if (parse) args.push('--parse', '--import');
    if (link) args.push('--link');
    
    // Run permit sync in background
    const syncProcess = spawn('node', args, {
      cwd: import.meta.dirname,
      detached: false,
      stdio: 'inherit'
    });

    // Release lock when process exits
    syncProcess.on('exit', (code) => {
      permitSyncInProgress = false;
      console.log(`🔓 Permit sync lock released (exit code: ${code})\n`);
    });

    res.json({ 
      message: 'Permit sync started in background', 
      options: { download, parse, link }
    });
  } catch (error) {
    permitSyncInProgress = false;
    console.error('Error starting permit sync:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get permit sync status
app.get('/api/sync/permits/status', requireAuth, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM permits').get();
    const linked = db.prepare('SELECT COUNT(DISTINCT permit_id) as count FROM permit_mls_matches').get();
    const byYear = db.prepare(`
      SELECT year, COUNT(*) as count 
      FROM permits 
      WHERE year IS NOT NULL
      GROUP BY year 
      ORDER BY year DESC
    `).all();
    
    res.json({
      inProgress: permitSyncInProgress,
      totalPermits: total.count,
      linkedToMLS: linked.count,
      byYear
    });
  } catch (error) {
    console.error('Error fetching permit sync status:', error);
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

const HOST = process.env.HOST || '127.0.0.1';

app.listen(PORT, HOST, () => {
  console.log(`🏠 Aura Estates API running on http://${HOST}:${PORT}`);
  
  // Show database stats
  const stats = db.prepare('SELECT COUNT(*) as count FROM properties').get();
  console.log(`📊 Database contains ${stats.count} properties`);

  // Check if auto-sync is needed on startup
  checkAndAutoSync();
});
