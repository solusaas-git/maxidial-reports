import { NextRequest, NextResponse } from 'next/server';
import { getAdversusClient } from '@/lib/adversus-client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    const client = getAdversusClient();
    const data = await client.getAgents({ limit, offset });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Failed to fetch agents',
      },
      { status: error.response?.status || 500 }
    );
  }
}

