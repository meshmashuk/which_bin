import { NextRequest, NextResponse } from 'next/server';
import { findAddresses, ScraperError } from '@/lib/councilScraper';

// The council site's multi-step session flow can take 15-30s; Vercel's
// default function timeout (10s on Hobby) is too short for that.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let postcode: unknown;
  try {
    ({ postcode } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof postcode !== 'string' || postcode.trim().length < 5) {
    return NextResponse.json({ error: 'Please provide a valid UK postcode' }, { status: 400 });
  }

  try {
    const addresses = await findAddresses(postcode.trim());
    return NextResponse.json({ addresses });
  } catch (err) {
    if (err instanceof ScraperError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error('addresses lookup failed', err);
    return NextResponse.json({ error: 'Unexpected error looking up that postcode' }, { status: 500 });
  }
}
