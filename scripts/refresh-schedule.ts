// Run from a normal home/office network — the council's site blocks requests
// from cloud/datacenter IPs (including Vercel's), so this can't run as part
// of the deployed app. See app/api/addresses and app/api/schedule for why.
//
// Usage:
//   npm run refresh -- "<postcode>"                       list addresses at a postcode
//   npm run refresh -- "<postcode>" "<address fragment>"  fetch + cache one address's schedule
//   npm run refresh -- --batch <file>                     load many addresses from a list file
//                                                          (see scripts/neighbours.example.txt)
//
// Requires BLOB_READ_WRITE_TOKEN in .env.local (from the Vercel dashboard's
// Storage tab) so results are written to the same Blob store the deployed
// app reads from. Without it, results only land in the local .data/ cache.
//
// BN6 postcodes are checked against scripts/hassocks-postcodes.json (a
// best-effort reference list of the ~272 postcodes in Hassocks/Clayton
// parish, out of ~622 total in BN6 — the rest are Ditchling, Hurstpierpoint,
// Albourne, etc.) and flagged with a warning if not found — this is a
// same-outward-code area, not a hard boundary check, so it only warns.
// This is intentionally demand-driven: addresses are added one at a time
// as neighbours actually ask, not preloaded in bulk, since fully scraping
// the whole area would mean many hours of sustained requests against a
// small council server that's already shown it watches for bot traffic.

import { readFile } from 'fs/promises';
import { findAddresses, fetchSchedule, type AddressOption } from '../lib/councilScraper';
import { writeCachedSchedule, type StoredSchedule } from '../lib/scheduleStore';
import { upsertAddress } from '../lib/addressDirectory';
import hassocksPostcodes from './hassocks-postcodes.json' with { type: 'json' };

type Result = { ok: true; label: string; nextDate?: string } | { ok: false; reason: string };

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

function matchAddress(addresses: AddressOption[], fragment: string): AddressOption[] | AddressOption {
  const frag = fragment.toLowerCase();
  const matches = addresses.filter((a) => a.label.toLowerCase().startsWith(frag));
  if (matches.length === 1) return matches[0];
  return matches;
}

async function refreshOne(postcode: string, matchFragment: string): Promise<Result> {
  const addresses = await findAddresses(postcode);
  const matched = matchAddress(addresses, matchFragment);

  if (Array.isArray(matched)) {
    if (matched.length === 0) {
      return { ok: false, reason: `no address matched "${matchFragment}" at ${postcode}` };
    }
    return {
      ok: false,
      reason: `"${matchFragment}" at ${postcode} is ambiguous: ${matched.map((a) => a.label).join(' / ')}`,
    };
  }

  const { addressLabel, events } = await fetchSchedule(postcode, matched.pIndex);

  const data: StoredSchedule = {
    postcode: postcode.trim(),
    pIndex: matched.pIndex,
    addressLabel,
    events,
    fetchedAt: new Date().toISOString(),
  };
  await writeCachedSchedule(data);
  await upsertAddress({ postcode: postcode.trim(), pIndex: matched.pIndex, label: addressLabel });

  return { ok: true, label: addressLabel, nextDate: events[0]?.date };
}

async function runBatch(filePath: string) {
  const raw = await readFile(filePath, 'utf8');
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  console.log(`Loading ${lines.length} address(es) from ${filePath}...\n`);

  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const line of lines) {
    const [postcode, fragment] = line.split('|').map((s) => s.trim());
    if (!postcode || !fragment) {
      failed.push(`"${line}" — expected format: postcode | address fragment`);
      continue;
    }
    warnIfOutsideKnownArea(postcode);
    process.stdout.write(`${postcode} | ${fragment} ... `);
    try {
      const result = await refreshOne(postcode, fragment);
      if (result.ok) {
        console.log(`OK (${result.label}, next: ${result.nextDate ?? 'n/a'})`);
        succeeded.push(result.label);
      } else {
        console.log(`SKIPPED (${result.reason})`);
        failed.push(`${postcode} | ${fragment} — ${result.reason}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`FAILED (${message})`);
      failed.push(`${postcode} | ${fragment} — ${message}`);
    }
  }

  console.log(`\n${succeeded.length} loaded, ${failed.length} skipped/failed.`);
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

  if (args[0] === '--batch') {
    const filePath = args[1];
    if (!filePath) {
      console.error('Usage: npm run refresh -- --batch <file>');
      process.exit(1);
    }
    await runBatch(filePath);
    return;
  }

  const [postcode, matchFragment] = args;
  if (!postcode) {
    console.error('Usage: npm run refresh -- "<postcode>" ["address fragment"]');
    console.error('   or: npm run refresh -- --batch <file>');
    process.exit(1);
  }

  warnIfOutsideKnownArea(postcode);
  console.log(`Looking up addresses for ${postcode}...`);
  const addresses = await findAddresses(postcode);

  if (!matchFragment) {
    console.log(`Found ${addresses.length} address(es). Re-run with a fragment of the one you want, e.g.:\n`);
    for (const a of addresses.slice(0, 40)) {
      console.log(`  ${a.label}`);
    }
    if (addresses.length > 40) console.log(`  ...and ${addresses.length - 40} more`);
    return;
  }

  const result = await refreshOne(postcode, matchFragment);
  if (!result.ok) {
    console.error(result.reason);
    process.exit(1);
  }
  console.log(`\nSaved schedule for ${result.label}.`);
  if (result.nextDate) console.log(`Next collection: ${result.nextDate}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
