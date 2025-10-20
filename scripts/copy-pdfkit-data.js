/*
  Copy PDFKit's bundled font data into the function directory so runtime reads
  like './data/Helvetica.afm' resolve next to the compiled route file.
*/
const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  const pdfkitData = path.join(process.cwd(), 'node_modules', 'pdfkit', 'js', 'data');
  const target = path.join(process.cwd(), 'app', 'api', 'reports', 'generate-pdf', 'data');
  if (fs.existsSync(pdfkitData)) {
    copyDir(pdfkitData, target);
    console.log(`[copy-pdfkit-data] Copied fonts to: ${target}`);
  } else {
    console.warn('[copy-pdfkit-data] PDFKit data directory not found:', pdfkitData);
  }
} catch (err) {
  console.error('[copy-pdfkit-data] Error:', err);
  process.exit(0); // Do not fail the build
}


