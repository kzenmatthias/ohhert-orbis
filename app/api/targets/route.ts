import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const targets = db.getAllTargets();
    return NextResponse.json(targets);
  } catch (error) {
    console.error('Error fetching targets:', error);
    return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();
    
    const target = db.createTarget({
      name: body.name,
      requiresLogin: body.requiresLogin || false,
      loginUrl: body.loginUrl,
      usernameSelector: body.usernameSelector,
      passwordSelector: body.passwordSelector,
      submitSelector: body.submitSelector,
      usernameEnvKey: body.usernameEnvKey,
      passwordEnvKey: body.passwordEnvKey,
      urls: body.urls || [],
    });

    return NextResponse.json(target, { status: 201 });
  } catch (error) {
    console.error('Error creating target:', error);
    return NextResponse.json({ error: 'Failed to create target' }, { status: 500 });
  }
}