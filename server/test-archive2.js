// Test fetching the Wellesley archive - ES Module version

import fs from 'fs';

const ARCHIVE_URL = 'https://wellesleyma.gov/Archive.aspx?AMID=36';

async function test() {
  console.log('Fetching archive page...');
  const response = await fetch(ARCHIVE_URL);
  const html = await response.text();
  
  console.log('Page length:', html.length);
  
  // Find ADID links (these are archive document pages)
  const adidPattern = /Archive\.aspx\?ADID=(\d+)/gi;
  const adids = [];
  let match;
  while ((match = adidPattern.exec(html)) !== null) {
    adids.push(match[1]);
  }
  
  console.log('Found', adids.length, 'archive document links:', adids);
  
  // Check one of the document pages to find actual file links
  if (adids.length > 0) {
    console.log('\nChecking first document page (ADID=' + adids[0] + ')...');
    const docResponse = await fetch('https://wellesleyma.gov/Archive.aspx?ADID=' + adids[0]);
    const docHtml = await docResponse.text();
    
    // Look for ViewFile or direct file links
    const filePattern = /href="([^"]*(?:ViewFile|\.pdf|\.csv|\.xlsx)[^"]*)"/gi;
    const files = [];
    while ((match = filePattern.exec(docHtml)) !== null) {
      files.push(match[1]);
    }
    console.log('File links in document page:', files);
    
    // Save for inspection
    fs.writeFileSync('doc-page.html', docHtml);
    console.log('Saved doc page to doc-page.html');
  }
  
  // Save main archive page
  fs.writeFileSync('archive-page.html', html);
  console.log('\nSaved main page to archive-page.html');
  
  // Look for specific 2025 patterns
  const has2025 = html.includes('2025');
  const hasResidential = html.includes('Residential');
  console.log('\nContains "2025":', has2025);
  console.log('Contains "Residential":', hasResidential);
  
  // Extract titles/descriptions
  const titlePattern = /<span[^>]*class="[^"]*archiveDesc[^"]*"[^>]*>([^<]+)/gi;
  const titles = [];
  while ((match = titlePattern.exec(html)) !== null) {
    titles.push(match[1].trim());
  }
  console.log('\nArchive titles found:', titles);
}

test().catch(console.error);
