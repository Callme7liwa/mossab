import xlsx from 'xlsx';
import path from 'path';

const files = [
  'vLIVE.2025-1.20.26_new construction tracker  (1).xlsx',
  'vSHARE.2021-2024 years New Con B.P. and MLS sold data.unmapped.xlsx'
];

for (const file of files) {
  console.log('\n' + '='.repeat(80));
  console.log('FILE:', file);
  console.log('='.repeat(80));
  
  try {
    const wb = xlsx.readFile(file);
    console.log('Sheets:', wb.SheetNames);
    console.log('Total sheets:', wb.SheetNames.length);
    
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      const headers = data[0] || [];
      
      console.log(`\n  Sheet: "${sheetName}"`);
      console.log(`  Rows: ${data.length - 1}`);
      console.log(`  Columns (${headers.length}):`);
      headers.forEach((h, i) => console.log(`    ${i+1}. ${h}`));
    }
  } catch (err) {
    console.log('Error reading file:', err.message);
  }
}
