import { NextRequest, NextResponse } from 'next/server';
import { getAdversusClient } from '@/lib/adversus-client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const groupBy = searchParams.get('groupBy') || undefined;

    const client = getAdversusClient();
    const data = await client.getStatistics({
      startDate,
      endDate,
      groupBy,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to fetch statistics',
      },
      { status: error.response?.status || 500 }
    );
  }
}

