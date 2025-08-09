import { NextRequest, NextResponse } from 'next/server';
import { planStore, tokenStore } from '@/lib/planStore';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') || '';
    const map = tokenStore[token];
    if (!map) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const session = planStore[map.sessionId];
    const pdfBase64 = session?.report?.pdfBase64;
    if (!pdfBase64) return NextResponse.json({ error: 'Report not ready' }, { status: 404 });

    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Interview_Report_${map.sessionId}.pdf"`,
      },
    });
  } catch (e) {
    console.error('❌ /api/hr/report/pdf:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}