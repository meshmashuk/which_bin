// Run from a normal home/office network — the council's site blocks requests
// from cloud/datacenter IPs (including Vercel's), so this can't run as part
// of the deployed app. See app/api/addresses and app/api/schedule for why.
//
// Usage:
//   npm run refresh -- "<postcode>"                       list addresses at a postcode
//   npm run refresh -- "<postcode>" "<address fragment>"  fetch + cache one address's schedule
//
// Requires BLOB_READ_WRITE_TOKEN in .env.local (from the Vercel dashboard's
// Storage tab) so results are written to the same Blob store the deployed
// app reads from. Without it, results only land in the local .data/ cache.

import { findAddresses, fetchSchedule } from '../lib/councilScraper';
import { writeCachedSchedule, type StoredSchedule } from '../lib/scheduleStore';
import { upsertAddress } from '../lib/addressDirectory';

async function main() {
  const [postcode, matchFragment] = process.argv.slice(2);
  if (!postcode) {
    console.error('Usage: npm run refresh -- "<postcode>" ["address fragment"]');
    process.exit(1);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn(
      'Warning: BLOB_READ_WRITE_TOKEN is not set — this will only update the local .data/ cache, not the deployed app.',
    );
  }

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

  const frag = matchFragment.toLowerCase();
  const matches = addresses.filter((a) => a.label.toLowerCase().startsWith(frag));
  if (matches.length === 0) {
    console.error(`No address matched "${matchFragment}". Run without a fragment to see all addresses.`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`Multiple addresses matched "${matchFragment}":`);
    for (const a of matches) console.error(`  ${a.label}`);
    console.error('Use a more specific fragment (e.g. include the house number).');
    process.exit(1);
  }

  const address = matches[0];
  console.log(`Fetching schedule for: ${address.label}`);
  const { addressLabel, events } = await fetchSchedule(postcode, address.pIndex);

  const data: StoredSchedule = {
    postcode: postcode.trim(),
    pIndex: address.pIndex,
    addressLabel,
    events,
    fetchedAt: new Date().toISOString(),
  };
  await writeCachedSchedule(data);
  await upsertAddress({ postcode: postcode.trim(), pIndex: address.pIndex, label: addressLabel });

  console.log(`\nSaved ${events.length} collection date(s) for ${addressLabel}.`);
  if (events[0]) console.log(`Next: ${events[0].date} — ${events[0].service}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
