import db from './db.js';

console.log('🔍 Checking photos in database...\n');

// Check if photos column exists
const columns = db.prepare("PRAGMA table_info(properties)").all();
console.log('📋 Database columns:', columns.map(c => c.name).join(', '));
console.log('');

const hasPhotos = columns.some(col => col.name === 'photos');
console.log(`✓ Photos column exists: ${hasPhotos}`);
console.log('');

// Get a sample of properties with their photos
const sampleProperties = db.prepare(`
  SELECT id, mlsId, address, photoUrl, photos
  FROM properties
  WHERE status = 'Active'
  LIMIT 10
`).all();

console.log('📸 Sample of 10 Active properties:\n');

sampleProperties.forEach((prop, index) => {
  console.log(`${index + 1}. ${prop.address}`);
  console.log(`   MLS ID: ${prop.mlsId}`);
  console.log(`   photoUrl: ${prop.photoUrl ? 'Yes' : 'No'}`);
  console.log(`   photos column: ${prop.photos ? prop.photos.substring(0, 100) + '...' : 'NULL'}`);
  
  if (prop.photos) {
    try {
      const photosArray = JSON.parse(prop.photos);
      console.log(`   ✓ Parsed photos count: ${photosArray.length}`);
    } catch (e) {
      console.log(`   ✗ Error parsing photos: ${e.message}`);
    }
  }
  console.log('');
});

// Get statistics
const stats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    COUNT(photoUrl) as hasPhotoUrl,
    COUNT(photos) as hasPhotos
  FROM properties
  WHERE status = 'Active'
`).get();

console.log('📊 Statistics for Active properties:');
console.log(`   Total: ${stats.total}`);
console.log(`   Has photoUrl: ${stats.hasPhotoUrl}`);
console.log(`   Has photos: ${stats.hasPhotos}`);
console.log('');

// Check one property in detail
const detailProp = db.prepare(`
  SELECT *
  FROM properties
  WHERE status = 'Active' AND photoUrl IS NOT NULL
  LIMIT 1
`).get();

if (detailProp) {
  console.log('🔬 Detailed view of one property:');
  console.log(`   Address: ${detailProp.address}`);
  console.log(`   MLS ID: ${detailProp.mlsId}`);
  console.log(`   photoUrl: ${detailProp.photoUrl}`);
  console.log(`   photos raw: ${detailProp.photos}`);
  
  if (detailProp.photos) {
    try {
      const photosArray = JSON.parse(detailProp.photos);
      console.log(`   Photos array length: ${photosArray.length}`);
      console.log(`   Photos array:`, JSON.stringify(photosArray, null, 2));
    } catch (e) {
      console.log(`   Error parsing: ${e.message}`);
    }
  }
}
