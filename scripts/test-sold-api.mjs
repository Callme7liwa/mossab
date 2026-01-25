// Test the Sold Analytics API call
const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

const towns = ["Weston", "Wellesley", "Newton", "Needham", "Dover", "Natick", "Westwood"];
const townFilter = towns.map(town => `City eq '${town}'`).join(" or ");
const typeFilter = `PropertyType eq 'Residential' and PropertySubType eq 'Single Family Residence'`;
const statusFilter = `StandardStatus eq 'Closed'`;

const finalFilter = `(${statusFilter}) and (${townFilter}) and ${typeFilter}`;

console.log("Filter:", finalFilter);

const params = new URLSearchParams();
params.set("$top", "10");
params.set("$count", "true");
params.set("$filter", finalFilter);

const url = `${BRIDGE_API_BASE}/Property?${params.toString()}`;
console.log("\nURL:", url);

const response = await fetch(url, {
  headers: {
    "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
    "Accept": "application/json",
  },
});

if (!response.ok) {
  const text = await response.text();
  console.error("Error:", response.status, text);
  process.exit(1);
}

const data = await response.json();
console.log("\nTotal count:", data["@odata.count"]);
console.log("Properties returned:", data.value.length);
console.log("\nSample properties:");
data.value.slice(0, 5).forEach((p, i) => {
  console.log(`${i + 1}. ${p.UnparsedAddress || p.StreetNumber + ' ' + p.StreetName}`);
  console.log(`   Status: ${p.StandardStatus}, City: ${p.City}`);
  console.log(`   List: $${p.ListPrice?.toLocaleString()}, Close: $${p.ClosePrice?.toLocaleString()}`);
});
