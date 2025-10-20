import { NextRequest, NextResponse } from 'next/server';
import { ReportGenerator } from '@/lib/report-generator';
import { ServerPDFGenerator } from '@/lib/pdf-generator-server';
import { reportCache } from '@/lib/report-cache';
import fs from 'fs';
import path from 'path';

// Monkey-patch PDFKit's font loading to use /tmp directory on Vercel
function patchPDFKitForVercel() {
  if (!process.env.VERCEL) return;
  
  try {
    const publicFontsPath = path.join(process.cwd(), 'public', 'fonts');
    const tmpFontsPath = path.join('/tmp', 'pdfkit-fonts');
    
    console.log(`[PDF Setup] Setting up fonts in /tmp`);
    console.log(`[PDF Setup] Source: ${publicFontsPath}`);
    console.log(`[PDF Setup] Target: ${tmpFontsPath}`);
    
    // Create /tmp fonts directory
    if (!fs.existsSync(tmpFontsPath)) {
      fs.mkdirSync(tmpFontsPath, { recursive: true });
      console.log(`[PDF Setup] Created ${tmpFontsPath}`);
    }
    
    // Copy fonts if not already there
    const targetHelvetica = path.join(tmpFontsPath, 'Helvetica.afm');
    if (!fs.existsSync(targetHelvetica)) {
      if (fs.existsSync(publicFontsPath)) {
        const fontFiles = fs.readdirSync(publicFontsPath);
        fontFiles.forEach(file => {
          fs.copyFileSync(
            path.join(publicFontsPath, file),
            path.join(tmpFontsPath, file)
          );
        });
        console.log(`[PDF Setup] Copied ${fontFiles.length} font files`);
      }
    }
    
    // Monkey-patch PDFKit's internal font path resolution
    // PDFKit looks for fonts using: require('path').join(__dirname, '../data')
    // We need to intercept this and redirect to /tmp/pdfkit-fonts
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    
    Module.prototype.require = function(id: string) {
      const module = originalRequire.apply(this, arguments);
      
      // Intercept 'fs' module calls in PDFKit context
      if (id === 'fs' && this.filename?.includes('pdfkit')) {
        return new Proxy(module, {
          get(target, prop) {
            if (prop === 'readFileSync') {
              return function(filepath: string, ...args: any[]) {
                // Redirect font file reads to /tmp
                if (filepath.includes('/data/') && filepath.endsWith('.afm')) {
                  const fontName = path.basename(filepath);
                  const newPath = path.join(tmpFontsPath, fontName);
                  console.log(`[PDF Setup] Redirecting font read: ${filepath} -> ${newPath}`);
                  return target.readFileSync(newPath, ...args);
                }
                return target.readFileSync(filepath, ...args);
              };
            }
            return target[prop];
          }
        });
      }
      
      return module;
    };
    
    console.log('[PDF Setup] PDFKit font patching complete');
  } catch (error) {
    console.error('[PDF Setup] Error patching PDFKit:', error);
  }
}

export async function POST(request: NextRequest) {
  // Patch PDFKit for Vercel environment
  patchPDFKitForVercel();
  try {
    const body = await request.json();
    const { reportType, startDate, endDate } = body;

    if (!reportType || !startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required parameters: reportType, startDate, endDate',
        },
        { status: 400 }
      );
    }

    console.log(`[PDF Generation] Starting PDF generation for ${reportType}`);
    console.log(`[PDF Generation] Date range: ${startDate} to ${endDate}`);

    // Check cache first
    let reportData = reportCache.get(reportType, startDate, endDate);
    
    if (!reportData) {
      // Cache miss - generate report data
      console.log('[PDF Generation] Cache miss - generating report data');
      const generator = new ReportGenerator();
      reportData = await generator.generateReport(reportType, startDate, endDate);
      
      // Store in cache (30 minutes TTL)
      reportCache.set(reportType, startDate, endDate, reportData);
    } else {
      console.log('[PDF Generation] Using cached report data');
    }

    console.log(`[PDF Generation] Report data ready`);

    // Generate PDF
    const pdfGenerator = new ServerPDFGenerator();
    const pdfDoc = await pdfGenerator.generatePDF(reportData, {
      title: getReportTitle(reportType),
      dateRange: { startDate, endDate }
    });

    console.log(`[PDF Generation] PDF document created, streaming response...`);

    // Create a buffer to collect the PDF data
    const chunks: Buffer[] = [];
    
    return new Promise<NextResponse>((resolve, reject) => {
      pdfDoc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      pdfDoc.on('end', () => {
        console.log(`[PDF Generation] PDF generation completed successfully`);
        const pdfBuffer = Buffer.concat(chunks);
        
        // Create response with PDF
        const response = new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${getReportFilename(reportType, startDate, endDate)}"`,
            'Content-Length': pdfBuffer.length.toString(),
          },
        });
        
        resolve(response);
      });

      pdfDoc.on('error', (error: Error) => {
        console.error('[PDF Generation] Error generating PDF:', error);
        reject(error);
      });

      // Finalize the PDF
      pdfGenerator.end();
    });

  } catch (error: any) {
    console.error('[PDF Generation] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to generate PDF',
        error: error.toString()
      },
      { status: 500 }
    );
  }
}

function getReportTitle(reportType: string): string {
  switch (reportType) {
    case 'call-summary': return 'Call Summary Report';
    case 'agent-performance': return 'Agent Performance Report';
    case 'campaign-analytics': return 'Campaign Analytics Report';
    default: return 'Report';
  }
}

function getReportFilename(reportType: string, startDate: string, endDate: string): string {
  const title = getReportTitle(reportType).toLowerCase().replace(/\s+/g, '-');
  
  // Extract just the date part (YYYY-MM-DD) from ISO timestamp
  const start = startDate.split('T')[0];
  const end = endDate.split('T')[0];
  const generated = new Date().toISOString().split('T')[0];
  
  return `${title}-${start}-to-${end}-${generated}.pdf`;
}

