const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const db = require('../services/db.service');

async function importCompanyLogos() {
  const filePath =
    process.argv[2] ||
    path.join(__dirname, '../../Downloads/gaif-members.xls');

  console.log('Reading file:', filePath);

  const workbook = new ExcelJS.Workbook();

  // Try to read as xlsx first, then as xls
  try {
    await workbook.xlsx.readFile(filePath);
  } catch (e) {
    console.log('Trying to read as CSV or older format...');
    // For .xls files, we might need to convert first
    // exceljs primarily supports xlsx
  }

  const worksheet = workbook.getWorksheet(1);

  if (!worksheet) {
    console.error('No worksheet found!');
    process.exit(1);
  }

  console.log('Worksheet name:', worksheet.name);
  console.log('Row count:', worksheet.rowCount);

  // Get images from the worksheet
  const images = worksheet.getImages();
  console.log('Total images found:', images.length);

  if (images.length === 0) {
    console.log('\nNo embedded images found in the worksheet.');
    console.log('The .xls format may not support image extraction with exceljs.');
    console.log('\nTry converting the file to .xlsx format and run again.');
    process.exit(0);
  }

  // Create output directory for images
  const outputDir = path.join(__dirname, '../uploads/company-logos');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Map images to rows
  let imagesProcessed = 0;

  for (const image of images) {
    try {
      const imageId = image.imageId;
      const range = image.range;

      // Get the row number from the image position
      const rowNumber = range.tl.row + 1; // +1 because rows are 0-indexed

      // Get company data from that row
      const row = worksheet.getRow(rowNumber);
      const companyNo = row.getCell(1).value; // NO column
      const companyName = row.getCell(3).value; // NAME OF CO column

      console.log(`\nImage for row ${rowNumber}: ${companyName}`);

      // Get the image data
      const imageData = workbook.model.media.find(m => m.index === imageId);

      if (imageData && imageData.buffer) {
        // Determine file extension
        const ext = imageData.extension || 'png';
        const fileName = `company_${companyNo}_${Date.now()}.${ext}`;
        const filePath = path.join(outputDir, fileName);

        // Save image to file
        fs.writeFileSync(filePath, imageData.buffer);
        console.log(`  Saved: ${fileName}`);

        // Find company in database and update logo
        // You would need to implement your file upload logic here
        // For now, just save the images locally

        imagesProcessed++;
      }
    } catch (error) {
      console.error(`Error processing image:`, error.message);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log('Images processed:', imagesProcessed);
  console.log('Images saved to:', outputDir);

  process.exit(0);
}

importCompanyLogos().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
