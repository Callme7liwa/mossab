// Examine PDF text content to understand the format
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const PERMITS_DIR = path.join(process.cwd(), 'permits');

async function examine() {
  // Look at an older PDF (2009)
  const file = process.argv[2] || 'permits_2009_all.pdf';
  const filepath = path.join(PERMITS_DIR, file);
  
  console.log(`Examining ${file}...\n`);
  
  const buffer = fs.readFileSync(filepath);
  const data = await pdfParse(buffer);
  
  // Save full text for analysis
  fs.writeFileSync('permit_text_sample.txt', data.text);
  console.log(`Full text saved to permit_text_sample.txt (${data.text.length} chars)`);
  
  // Show first 5000 chars
  console.log('\n=== First 5000 characters ===\n');
  console.log(data.text.substring(0, 5000));
}

examine().catch(console.error);
