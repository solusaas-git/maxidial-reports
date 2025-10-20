import { NextRequest, NextResponse } from 'next/server';
import { ReportGenerator } from '@/lib/report-generator';
import { ServerPDFGenerator } from '@/lib/pdf-generator-server';
import { reportCache } from '@/lib/report-cache';
import fs from 'fs';
import path from 'path';

// Setup fonts for PDFKit on Vercel
function setupPDFKitFonts() {
  if (!process.env.VERCEL) return; // Only needed on Vercel
  
  try {
    const publicFontsPath = path.join(process.cwd(), 'public', 'fonts');
    const targetPath = path.join('/tmp', 'data'); // PDFKit looks in ./data relative to execution
    
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    
    // Check if fonts already copied (for warm lambda)
    const targetHelveticaPath = path.join(targetPath, 'Helvetica.afm');
    if (fs.existsSync(targetHelveticaPath)) {
      console.log('[PDF Setup] Fonts already available');
      return;
    }
    
    // Copy all font files from public/fonts to /tmp/data
    if (fs.existsSync(publicFontsPath)) {
      const fontFiles = fs.readdirSync(publicFontsPath);
      fontFiles.forEach(file => {
        const sourcePath = path.join(publicFontsPath, file);
        const destPath = path.join(targetPath, file);
        fs.copyFileSync(sourcePath, destPath);
      });
      console.log(`[PDF Setup] Copied ${fontFiles.length} font files to ${targetPath}`);
    } else {
      console.error('[PDF Setup] Font source directory not found:', publicFontsPath);
    }
  } catch (error) {
    console.error('[PDF Setup] Error setting up fonts:', error);
  }
}

export async function POST(request: NextRequest) {
  // Setup fonts before PDF generation
  setupPDFKitFonts();
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

