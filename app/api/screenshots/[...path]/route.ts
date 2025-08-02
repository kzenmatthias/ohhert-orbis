import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Reconstruct the file path from the segments
    const filePath = path.join(process.cwd(), 'screenshots', ...params.path);
    
    // Security check: ensure the path is within the screenshots directory
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    const resolvedPath = path.resolve(filePath);
    const resolvedScreenshotsDir = path.resolve(screenshotsDir);
    
    if (!resolvedPath.startsWith(resolvedScreenshotsDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }

    // Check if file exists and is a PNG
    if (!resolvedPath.endsWith('.png')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    try {
      const fileBuffer = await fs.readFile(resolvedPath);
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        },
      });
    } catch (error) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error serving screenshot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}