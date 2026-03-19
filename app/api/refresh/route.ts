import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_DIVISION_URL } from '@/lib/config';
import { buildDivisionScout } from '@/lib/scrape';
import { writeCachedDivision } from '@/lib/storage';

function isAuthorized(request: NextRequest): boolean {
  const cronHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!secret) return true;
  return cronHeader === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await buildDivisionScout(DEFAULT_DIVISION_URL);
    await writeCachedDivision(data);
    return NextResponse.json({ ok: true, lastUpdated: data.lastUpdated, teamCount: data.teams.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Refresh failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
