import { NextRequest, NextResponse } from 'next/server';
import { ReportGenerator } from '@/lib/report-generator';
import { reportCache } from '@/lib/report-cache';

export async function POST(request: NextRequest) {
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

    // Always generate fresh report when user clicks "Generate Report"
    console.log('[Report Generation] Generating fresh report and caching for PDF export');
    const generator = new ReportGenerator();
    const reportData = await generator.generateReport(reportType, startDate, endDate);
    
    // Store in cache for PDF generation (30 minutes TTL)
    reportCache.set(reportType, startDate, endDate, reportData);

    return NextResponse.json({
      success: true,
      data: reportData,
    });
  } catch (error: any) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to generate report',
      },
      { status: 500 }
    );
  }
}

