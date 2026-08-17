import { NextRequest, NextResponse } from 'next/server';
import { findAddressesForPostcode } from '@/lib/addressDirectory';

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

  const addresses = await findAddressesForPostcode(postcode.trim());
  if (addresses.length === 0) {
    return NextResponse.json(
      {
        error:
          "No addresses have been loaded for that postcode yet. The council's site blocks lookups from this server, so a new postcode needs to be added by running the refresh script from a home network — see scripts/refresh-schedule.ts.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ addresses: addresses.map(({ pIndex, label }) => ({ pIndex, label })) });
}
