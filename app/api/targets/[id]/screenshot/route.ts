import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getLatestScreenshot } from '@/lib/screenshot-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const target = db.getTarget(parseInt(params.id));
    
    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    const screenshot = await getLatestScreenshot(target.name);
    
    if (!screenshot) {
      return NextResponse.json({ screenshot: null });
    }

    // Return screenshot info with API path
    return NextResponse.json({
      screenshot: {
        filename: screenshot.filename,
        date: screenshot.date,
        timestamp: screenshot.timestamp,
        url: `/api/screenshots/${screenshot.date}/${screenshot.filename}`,
      }
    });
  } catch (error) {
    console.error('Error getting screenshot for target:', error);
    return NextResponse.json({ error: 'Failed to get screenshot' }, { status: 500 });
  }
}