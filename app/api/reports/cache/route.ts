import { NextRequest, NextResponse } from 'next/server';
import { reportCache } from '@/lib/report-cache';

/**
 * GET /api/reports/cache - Get cache statistics
 */
export async function GET(request: NextRequest) {
  try {
    const stats = reportCache.getStats();
    
    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error getting cache stats:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to get cache stats',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports/cache - Clear cache
 */
export async function DELETE(request: NextRequest) {
  try {
    reportCache.clear();
    
    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error: any) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to clear cache',
      },
      { status: 500 }
    );
  }
}

