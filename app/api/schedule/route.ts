import { NextRequest, NextResponse } from 'next/server';
import { fetchScheduleForPostcode, ScraperError } from '@/lib/councilScraper';
import { readCachedSchedule, writeCachedSchedule, type StoredSchedule } from '@/lib/scheduleStore';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get('postcode')?.trim();
  const force = req.nextUrl.searchParams.get('force') === '1';

  if (!postcode) {
    return NextResponse.json({ error: 'postcode is required' }, { status: 400 });
  }

  if (!force) {
    const cached = await readCachedSchedule(postcode);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }
  }

  try {
    const { events } = await fetchScheduleForPostcode(postcode);
    const data: StoredSchedule = {
      postcode,
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
