import { NextRequest, NextResponse } from 'next/server';
import { buildDivisionScout } from '@/lib/scrape';
import { DEFAULT_DIVISION_URL } from '@/lib/config';

export async function GET(request: NextRequest) {
  const divisionUrl = request.nextUrl.searchParams.get('divisionUrl') || DEFAULT_DIVISION_URL;

  try {
    const data = await buildDivisionScout(divisionUrl);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown scrape error.' },
      { status: 500 }
    );
  }
}
