import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getLatestSessionScreenshots } from '@/lib/screenshot-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const target = db.getTarget(parseInt(id));
    
    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    const screenshots = await getLatestSessionScreenshots(target.name);
    
    if (screenshots.length === 0) {
      return NextResponse.json({ screenshots: [] });
    }

    // Return screenshot info with API paths
    return NextResponse.json({
      screenshots: screenshots.map(screenshot => ({
        filename: screenshot.filename,
        date: screenshot.date,
        timestamp: screenshot.timestamp,
        url: `/api/screenshots/${screenshot.date}/${screenshot.filename}`,
      }))
    });
  } catch (error) {
    console.error('Error getting screenshot for target:', error);
    return NextResponse.json({ error: 'Failed to get screenshot' }, { status: 500 });
  }
}