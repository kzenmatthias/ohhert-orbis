import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { screenshotService } from '@/lib/screenshot';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetIds } = body;
    
    const db = getDb();
    let targets;
    
    if (targetIds && Array.isArray(targetIds)) {
      // Screenshot specific targets
      targets = targetIds
        .map(id => db.getTarget(parseInt(id)))
        .filter(target => target !== undefined);
    } else {
      // Screenshot all targets
      targets = db.getAllTargets();
    }

    if (targets.length === 0) {
      return NextResponse.json({ error: 'No targets found' }, { status: 400 });
    }

    console.log(`Starting screenshot run for ${targets.length} targets`);
    const results = await screenshotService.captureAllScreenshots(targets);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Screenshot run completed: ${successCount} successful, ${failureCount} failed`);

    return NextResponse.json({
      success: true,
      totalTargets: targets.length,
      successCount,
      failureCount,
      results,
    });
  } catch (error) {
    console.error('Error running screenshots:', error);
    return NextResponse.json(
      { error: 'Failed to run screenshots' },
      { status: 500 }
    );
  }
}