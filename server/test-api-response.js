// Test API response
const API_URL = 'http://localhost:3001/api';

async function testAPI() {
  console.log('🔍 Testing API response...\n');
  
  // Get one property
  const response = await fetch(`${API_URL}/properties?status=Active&limit=1`);
  const data = await response.json();
  
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (data.properties && data.properties.length > 0) {
    const prop = data.properties[0];
    console.log('\n📸 Photos info:');
    console.log('Type:', typeof prop.photos);
    console.log('Is Array:', Array.isArray(prop.photos));
    console.log('Value:', prop.photos);
    
    if (prop.photos && typeof prop.photos === 'string') {
      console.log('\n⚠️ ISSUE: photos is a STRING, not an array!');
      console.log('Parsed:', JSON.parse(prop.photos));
    }
  }
}

testAPI().catch(console.error);
