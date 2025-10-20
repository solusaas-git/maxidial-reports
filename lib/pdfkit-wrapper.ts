/**
 * PDFKit wrapper for Vercel compatibility
 * This module sets up fonts and canvas before importing PDFKit
 */
import fs from 'fs';
import path from 'path';

// Setup canvas module cache hijacking BEFORE any imports
if (process.env.VERCEL) {
  try {
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    
    // Intercept all require('canvas') calls and redirect to @napi-rs/canvas
    Module.prototype.require = function(id: string) {
      if (id === 'canvas') {
        console.log('[PDFKit Wrapper] Redirecting canvas require to @napi-rs/canvas');
        return originalRequire.call(this, '@napi-rs/canvas');
      }
      return originalRequire.apply(this, arguments);
    };
    
    console.log('[PDFKit Wrapper] ✓ Canvas module redirection active');
  } catch (error) {
    console.error('[PDFKit Wrapper] Canvas setup error:', error);
  }
}

// Setup fonts in /tmp before loading PDFKit
if (process.env.VERCEL) {
  const publicFontsPath = path.join(process.cwd(), 'public', 'fonts');
  const tmpFontsPath = path.join('/tmp', 'pdfkit-data');
  
  console.log(`[PDFKit Wrapper] Setting up fonts for Vercel`);
  console.log(`[PDFKit Wrapper] Source: ${publicFontsPath}`);
  console.log(`[PDFKit Wrapper] Target: ${tmpFontsPath}`);
  
  try {
    // Create /tmp fonts directory
    if (!fs.existsSync(tmpFontsPath)) {
      fs.mkdirSync(tmpFontsPath, { recursive: true });
    }
    
    // Copy fonts if not already there
    const targetHelvetica = path.join(tmpFontsPath, 'Helvetica.afm');
    if (!fs.existsSync(targetHelvetica)) {
      if (fs.existsSync(publicFontsPath)) {
        const fontFiles = fs.readdirSync(publicFontsPath);
        fontFiles.forEach(file => {
          const src = path.join(publicFontsPath, file);
          const dest = path.join(tmpFontsPath, file);
          fs.copyFileSync(src, dest);
          console.log(`[PDFKit Wrapper] Copied ${file}`);
        });
        console.log(`[PDFKit Wrapper] ✓ Copied ${fontFiles.length} font files to ${tmpFontsPath}`);
      } else {
        console.error(`[PDFKit Wrapper] Font source not found: ${publicFontsPath}`);
      }
    } else {
      console.log(`[PDFKit Wrapper] ✓ Fonts already available in ${tmpFontsPath}`);
    }
    
    // Monkey-patch fs.readFileSync to redirect PDFKit font reads
    const originalReadFileSync = fs.readFileSync;
    (fs as any).readFileSync = function(filepath: any, ...args: any[]) {
      // Redirect font file reads to /tmp
      if (typeof filepath === 'string' && 
          filepath.includes('/data/') && 
          filepath.endsWith('.afm')) {
        const fontName = path.basename(filepath);
        const newPath = path.join(tmpFontsPath, fontName);
        console.log(`[PDFKit Wrapper] Redirecting: ${path.basename(filepath)} -> ${newPath}`);
        return originalReadFileSync.call(this, newPath, ...args);
      }
      return originalReadFileSync.call(this, filepath, ...args);
    };
    
    console.log('[PDFKit Wrapper] ✓ Font redirection active');
  } catch (error) {
    console.error('[PDFKit Wrapper] Setup error:', error);
  }
}

// Now import and export PDFKit
import PDFDocument from 'pdfkit';
export default PDFDocument;
export { PDFDocument };

