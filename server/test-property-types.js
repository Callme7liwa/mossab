import 'dotenv/config';

const API_BASE = 'https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4';
const API_TOKEN = process.env.BRIDGE_API_TOKEN;

const TOWNS = ['Weston', 'Wellesley', 'Newton', 'Needham', 'Dover', 'Natick', 'Westwood'];
const cityFilter = TOWNS.map(t => `City eq '${t}'`).join(' or ');

async function testPropertyTypes() {
  console.log('Testing Bridge API for property types in MetroWest towns...\n');

  // Test different PropertySubType values
  const subTypes = [
    'Single Family Residence',
    'Condominium', 
    'Townhouse',
    'Multi Family',
    'Multi-Family',
    'Multifamily',
    'Two Family',
    'Three Family',
    'Land',
    'Rental',
  ];

  for (const subType of subTypes) {
    const filter = `(${cityFilter}) and PropertySubType eq '${subType}'`;
    const url = `${API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$top=1&$count=true`;
    
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${API_TOKEN}` }
      });
      const data = await response.json();
      const count = data['@odata.count'] || 0;
      console.log(`${subType}: ${count} properties`);
    } catch (error) {
      console.log(`${subType}: Error - ${error.message}`);
    }
  }

  // Also check what PropertyType values exist
  console.log('\n--- Checking PropertyType (not SubType) ---\n');
  
  const propTypes = ['Residential', 'Land', 'Commercial', 'Multi-Family', 'Rental'];
  
  for (const propType of propTypes) {
    const filter = `(${cityFilter}) and PropertyType eq '${propType}'`;
    const url = `${API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$top=1&$count=true`;
    
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${API_TOKEN}` }
      });
      const data = await response.json();
      const count = data['@odata.count'] || 0;
      console.log(`PropertyType '${propType}': ${count} properties`);
    } catch (error) {
      console.log(`PropertyType '${propType}': Error - ${error.message}`);
    }
  }

  // Get a sample to see actual values
  console.log('\n--- Sample of unique PropertySubType values ---\n');
  
  const sampleUrl = `${API_BASE}/Property?$filter=(${cityFilter})&$top=500&$select=PropertySubType,PropertyType`;
  const response = await fetch(encodeURI(sampleUrl), {
    headers: { Authorization: `Bearer ${API_TOKEN}` }
  });
  const data = await response.json();
  
  const subTypeCounts = {};
  const propTypeCounts = {};
  
  for (const prop of data.value || []) {
    const st = prop.PropertySubType || 'Unknown';
    const pt = prop.PropertyType || 'Unknown';
    subTypeCounts[st] = (subTypeCounts[st] || 0) + 1;
    propTypeCounts[pt] = (propTypeCounts[pt] || 0) + 1;
  }
  
  console.log('PropertySubType values found:');
  console.log(subTypeCounts);
  
  console.log('\nPropertyType values found:');
  console.log(propTypeCounts);
}

testPropertyTypes().catch(console.error);
