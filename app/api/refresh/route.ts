import { NextResponse } from 'next/server';
import { buildDivisionScout } from '@/lib/scrape';
import { writeCachedDivision } from '@/lib/storage';

const DIVISION_URL = 'https://rd2l.gg/divisions/U-ZTEMOBg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  try {
    const data = await buildDivisionScout(DIVISION_URL);
    await writeCachedDivision(data);

    return NextResponse.json({
      ok: true,
      message: 'Refresh complete. Reload the page in a moment.',
      teamCount: data.teams?.length ?? 0,
      lastUpdated: data.lastUpdated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
