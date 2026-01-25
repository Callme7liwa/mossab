// Test top=2000
const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

const filter = "StandardStatus eq 'Closed' and City eq 'Newton' and PropertyType eq 'Residential' and PropertySubType eq 'Single Family Residence'";

const params = new URLSearchParams();
params.set("$top", "2000");
params.set("$count", "true");
params.set("$filter", filter);

const url = `${BRIDGE_API_BASE}/Property?${params.toString()}`;
console.log("Testing top=2000...");
console.log("URL:", url.substring(0, 100) + "...");

const response = await fetch(url, {
  headers: {
    "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
    "Accept": "application/json",
  },
});

const data = await response.json();
console.log("Status:", response.status);
console.log("Count header:", data["@odata.count"]);
console.log("Returned:", data.value?.length);

if (data.value?.length > 0) {
  console.log("First:", data.value[0].StandardStatus, data.value[0].City);
}
if (data.error) {
  console.log("Error:", JSON.stringify(data.error, null, 2));
}
