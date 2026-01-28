// Test fetching and parsing the Wellesley archive page

const ARCHIVE_URL = 'https://wellesleyma.gov/Archive.aspx?AMID=36';

async function test() {
  console.log('Fetching archive page...');
  const response = await fetch(ARCHIVE_URL);
  const html = await response.text();
  
  console.log('Page length:', html.length);
  
  // Find all links
  const linkPattern = /href="([^"]+)"/gi;
  const links = [];
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    links.push(match[1]);
  }
  
  console.log('Total links found:', links.length);
  
  // Filter for ViewFile links (this is how the archive stores files)
  const viewFileLinks = links.filter(l => l.includes('ViewFile'));
  console.log('\nViewFile links:', viewFileLinks.length);
  viewFileLinks.forEach(l => console.log('  ', l));
  
  // Look for PDF/CSV references in the page
  const pdfLinks = links.filter(l => l.toLowerCase().includes('.pdf'));
  console.log('\nPDF links:', pdfLinks.length);
  pdfLinks.slice(0, 5).forEach(l => console.log('  ', l));
  
  // Look for any document references
  const docLinks = links.filter(l => 
    l.includes('DocumentCenter') || 
    l.includes('Archive') ||
    l.includes('Document')
  );
  console.log('\nDocument-related links:', docLinks.length);
  docLinks.slice(0, 10).forEach(l => console.log('  ', l));
  
  // Look for text containing "Permit" or "Building"
  const permitPattern = /<a[^>]*href="([^"]+)"[^>]*>[^<]*(?:permit|building)[^<]*/gi;
  const permitLinks = [];
  while ((match = permitPattern.exec(html)) !== null) {
    permitLinks.push({ url: match[1], text: match[0] });
  }
  console.log('\nLinks with permit/building text:', permitLinks.length);
  permitLinks.slice(0, 10).forEach(l => console.log('  ', l.url));
  
  // Save HTML for inspection
  require('fs').writeFileSync('archive-page.html', html);
  console.log('\nSaved page to archive-page.html for inspection');
}

test().catch(console.error);
