import { NextResponse } from 'next/server';
import { buildDivisionScout } from '@/lib/scrape';
import { writeCachedDivision } from '@/lib/storage';

const DIVISION_URL = 'https://rd2l.gg/divisions/U-ZTEMOBg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  try {
    console.log('Refresh started', { divisionUrl: DIVISION_URL });

    const data = await buildDivisionScout(DIVISION_URL);

    console.log('Refresh built data', {
      divisionName: data.divisionName,
      seasonName: data.seasonName,
      teamCount: data.teams?.length ?? 0,
      firstTeam: data.teams?.[0]?.name ?? null,
    });

    await writeCachedDivision(data);

    console.log('Refresh saved data successfully');

    return NextResponse.json({
      ok: true,
      message: 'Refresh complete. Reload the page in a moment.',
      meta: {
        teamCount: data.teams?.length ?? 0,
        lastUpdated: data.lastUpdated,
      },
    });
  } catch (error) {
    console.error('Refresh failed', error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown refresh error',
      },
      { status: 500 }
    );
  }
}
