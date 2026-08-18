// Run from a normal home/office network — the council's site blocks requests
// from cloud/datacenter IPs (including Vercel's), so this can't run as part
// of the deployed app. See app/api/schedule for why.
//
// Usage:
//   npm run refresh                    refresh every area in lib/areas.ts
//   npm run refresh -- "<postcode>"    one-off refresh of an arbitrary postcode
//                                      (useful for trying a new area before
//                                      adding it to lib/areas.ts)
//
// Requires BLOB_READ_WRITE_TOKEN in .env.local (from the Vercel dashboard's
// Storage tab) so results are written to the same Blob store the deployed
// app reads from. Without it, results only land in the local .data/ cache.
//
// Collection days are the same for every address sharing a postcode (a fixed
// area-wide round, verified against real data), so one postcode = one area.
// Garden waste is deliberately excluded (see lib/councilScraper.ts): it's an
// opt-in subscription that can vary by household, so it can't be reliably
// represented at postcode level.
//
// BN6 postcodes are checked against scripts/hassocks-postcodes.json (a
// best-effort reference list of the ~272 postcodes in Hassocks/Clayton
// parish, out of ~622 total in BN6 — the rest are Ditchling, Hurstpierpoint,
// Albourne, etc.) and flagged with a warning if not found — this is a
// same-outward-code area, not a hard boundary check, so it only warns.
//
// Note: the council site enforces a per-device daily rate limit ("Too Many
// Requests... try again tomorrow" on a 429). Keep batches modest.

import { fetchScheduleForPostcode, ScraperError } from '../lib/councilScraper';
import { writeCachedSchedule, type StoredSchedule } from '../lib/scheduleStore';
import { AREAS } from '../lib/areas';
import hassocksPostcodes from './hassocks-postcodes.json' with { type: 'json' };

const HASSOCKS_SET = new Set(hassocksPostcodes.map(normalizePostcode));

function normalizePostcode(postcode: string): string {
  return postcode.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Best-effort check against a reference list of Hassocks/Clayton postcodes
 * (see scripts/hassocks-postcodes.json). Not exhaustive — new addresses get
 * postcodes, and outward-code area boundaries occasionally shift — so this
 * only ever warns, never blocks, a lookup.
 */
function warnIfOutsideKnownArea(postcode: string) {
  if (!postcode.toUpperCase().startsWith('BN6')) return; // not our reference area at all
  if (!HASSOCKS_SET.has(normalizePostcode(postcode))) {
    console.warn(
      `  note: ${postcode} isn't in the Hassocks/Clayton reference list — double-check it before spending a scrape on it (could be a neighbouring village that shares the BN6 prefix, or just a newer postcode not in the list).`,
    );
  }
}

async function refreshOne(postcode: string): Promise<{ nextDate?: string }> {
  const { events } = await fetchScheduleForPostcode(postcode);

  const data: StoredSchedule = {
    postcode: postcode.trim(),
    events,
    fetchedAt: new Date().toISOString(),
  };
  await writeCachedSchedule(data);

  return { nextDate: events[0]?.date };
}

async function runAll() {
  console.log(`Refreshing ${AREAS.length} area(s) from lib/areas.ts...\n`);

  let succeeded = 0;
  const failed: string[] = [];

  for (const area of AREAS) {
    warnIfOutsideKnownArea(area.postcode);
    process.stdout.write(`${area.label} (${area.postcode}) ... `);
    try {
      const { nextDate } = await refreshOne(area.postcode);
      console.log(`OK (next: ${nextDate ?? 'n/a'})`);
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`FAILED (${message})`);
      failed.push(`${area.label} (${area.postcode}) — ${message}`);
    }
  }

  console.log(`\n${succeeded} loaded, ${failed.length} failed.`);
  if (failed.length > 0) {
    console.log('\nNeeds attention:');
    for (const f of failed) console.log(`  ${f}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn(
      'Warning: BLOB_READ_WRITE_TOKEN is not set — this will only update the local .data/ cache, not the deployed app.\n',
    );
  }

  if (args.length === 0) {
    await runAll();
    return;
  }

  const [postcode] = args;
  warnIfOutsideKnownArea(postcode);
  console.log(`Fetching schedule for ${postcode} (ad-hoc — not in lib/areas.ts)...`);
  try {
    const { nextDate } = await refreshOne(postcode);
    console.log(`\nSaved schedule for ${postcode}.`);
    if (nextDate) console.log(`Next collection: ${nextDate}`);
  } catch (err) {
    if (err instanceof ScraperError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
