import { NextRequest, NextResponse } from 'next/server';
import { planStore, tokenStore } from '@/lib/planStore';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') || '';
    const map = tokenStore[token];
    if (!map) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const session = planStore[map.sessionId];
    if (!session?.report) return NextResponse.json({ ready: false }, { status: 202 });

    const { generatedAt } = session.report;
    return NextResponse.json({ ready: true, generatedAt });
  } catch (e) {
    console.error('❌ /api/hr/report:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

