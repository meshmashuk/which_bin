import { NextRequest, NextResponse } from 'next/server';
import { fetchSchedule, ScraperError } from '@/lib/councilScraper';
import { readCachedSchedule, writeCachedSchedule, type StoredSchedule } from '@/lib/scheduleStore';

export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get('postcode')?.trim();
  const pIndex = req.nextUrl.searchParams.get('pIndex')?.trim();
  const force = req.nextUrl.searchParams.get('force') === '1';

  if (!postcode || !pIndex) {
    return NextResponse.json({ error: 'postcode and pIndex are required' }, { status: 400 });
  }

  if (!force) {
    const cached = await readCachedSchedule(postcode, pIndex);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }
  }

  try {
    const { addressLabel, events } = await fetchSchedule(postcode, pIndex);
    const data: StoredSchedule = {
      postcode,
      pIndex,
      addressLabel,
      events,
      fetchedAt: new Date().toISOString(),
    };
    await writeCachedSchedule(data);
    return NextResponse.json({ ...data, cached: false });
  } catch (err) {
    if (err instanceof ScraperError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error('schedule fetch failed', err);
    return NextResponse.json({ error: 'Unexpected error fetching the collection schedule' }, { status: 500 });
  }
}
