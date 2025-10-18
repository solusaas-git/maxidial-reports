import { NextRequest, NextResponse } from 'next/server';
import { getAdversusClient } from '@/lib/adversus-client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    const client = getAdversusClient();
    const data = await client.getLeads({
      startDate,
      endDate,
      status,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to fetch leads',
      },
      { status: error.response?.status || 500 }
    );
  }
}

