/**
 * PDFKit wrapper for Vercel compatibility
 * This module sets up fonts and canvas before importing PDFKit
 */
import fs from 'fs';
import path from 'path';

// Setup canvas module by pre-loading it into the module cache
if (process.env.VERCEL) {
  try {
    // Pre-load @napi-rs/canvas as 'canvas' in the module cache
    const napiCanvas = require('@napi-rs/canvas');
    const Module = require('module');
    
    console.log('[PDFKit Wrapper] Pre-caching canvas module');
    
    // Get the require cache
    const canvasModulePath = require.resolve('@napi-rs/canvas');
    console.log('[PDFKit Wrapper] @napi-rs/canvas resolved to:', canvasModulePath);
    
    // Try to resolve what 'canvas' would resolve to
    try {
      const canvasPath = require.resolve('canvas');
      console.log('[PDFKit Wrapper] canvas already exists at:', canvasPath);
    } catch (e) {
      console.log('[PDFKit Wrapper] canvas module not found, will redirect');
      
      // Add 'canvas' entry to module cache pointing to @napi-rs/canvas
      // Create multiple possible paths that 'canvas' might resolve to
      const possiblePaths = [
        'canvas',
        path.join(process.cwd(), 'node_modules', 'canvas'),
        path.join(process.cwd(), 'node_modules', 'canvas', 'index.js'),
      ];
      
      possiblePaths.forEach(p => {
        if (!Module._cache[p]) {
          Module._cache[p] = Module._cache[canvasModulePath];
          console.log('[PDFKit Wrapper] Cached canvas at:', p);
        }
      });
    }
    
    console.log('[PDFKit Wrapper] ✓ Canvas module cached');
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

