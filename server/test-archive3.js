// Parse archive page and find actual download links
import fs from 'fs';

const html = fs.readFileSync('archive-page.html', 'utf8');

// Find all ADID links with surrounding context
const pattern = /<a[^>]*href="Archive\.aspx\?ADID=(\d+)"[^>]*>[\s\S]*?<\/a>/gi;
let match;
const docs = [];

while ((match = pattern.exec(html)) !== null) {
  const adid = match[1];
  const block = match[0];
  
  // Extract title from span
  const titleMatch = block.match(/<span[^>]*>([^<]+)<\/span>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  docs.push({ adid, title, block: block.substring(0, 200) });
}

console.log('Documents found:', docs.length);
docs.forEach(d => {
  console.log(`\nADID=${d.adid}: ${d.title}`);
});

// Now fetch one ADID page to find the actual file
console.log('\n\nFetching ADID=893 (2025 Commercial) to find download link...');
fetch('https://wellesleyma.gov/Archive.aspx?ADID=893')
  .then(r => r.text())
  .then(docHtml => {
    console.log('Doc page length:', docHtml.length);
    
    // Save for inspection
    fs.writeFileSync('adid-893.html', docHtml);
    
    // Look for download links or embedded content
    if (docHtml.includes('iframe')) console.log('Contains iframe');
    if (docHtml.includes('embed')) console.log('Contains embed');
    if (docHtml.includes('.pdf')) console.log('Contains .pdf reference');
    if (docHtml.includes('download')) console.log('Contains download reference');
    
    // Find all href
    const hrefs = docHtml.match(/href="([^"]+)"/gi) || [];
    console.log('\nAll hrefs:', hrefs);
  });
