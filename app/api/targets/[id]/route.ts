import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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

    return NextResponse.json(target);
  } catch (error) {
    console.error('Error fetching target:', error);
    return NextResponse.json({ error: 'Failed to fetch target' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const db = getDb();
    
    const target = db.updateTarget(parseInt(params.id), {
      name: body.name,
      url: body.url,
      requiresLogin: body.requiresLogin,
      loginUrl: body.loginUrl,
      usernameSelector: body.usernameSelector,
      passwordSelector: body.passwordSelector,
      submitSelector: body.submitSelector,
      usernameEnvKey: body.usernameEnvKey,
      passwordEnvKey: body.passwordEnvKey,
    });

    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    return NextResponse.json(target);
  } catch (error) {
    console.error('Error updating target:', error);
    return NextResponse.json({ error: 'Failed to update target' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const success = db.deleteTarget(parseInt(params.id));
    
    if (!success) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting target:', error);
    return NextResponse.json({ error: 'Failed to delete target' }, { status: 500 });
  }
}