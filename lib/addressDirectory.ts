import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { AddressOption } from './councilScraper';

export interface DirectoryEntry extends AddressOption {
  postcode: string;
}

const KEY = 'addresses/index.json';
const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const LOCAL_FILE = path.join(process.cwd(), '.data', 'addresses_index.json');

function normalizePostcode(postcode: string): string {
  return postcode.trim().toUpperCase().replace(/\s+/g, '');
}

async function readAll(): Promise<DirectoryEntry[]> {
  if (!USE_BLOB) {
    try {
      const raw = await readFile(LOCAL_FILE, 'utf8');
      return JSON.parse(raw) as DirectoryEntry[];
    } catch {
      return [];
    }
  }

  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: KEY, limit: 1 });
  if (blobs.length === 0) return [];
  const res = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!res.ok) return [];
  return (await res.json()) as DirectoryEntry[];
}

async function writeAll(entries: DirectoryEntry[]): Promise<void> {
  if (!USE_BLOB) {
    await mkdir(path.dirname(LOCAL_FILE), { recursive: true });
    await writeFile(LOCAL_FILE, JSON.stringify(entries, null, 2), 'utf8');
    return;
  }

  const { put } = await import('@vercel/blob');
  await put(KEY, JSON.stringify(entries), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/** Addresses previously loaded via the local refresh script, matching a postcode. */
export async function findAddressesForPostcode(postcode: string): Promise<DirectoryEntry[]> {
  const norm = normalizePostcode(postcode);
  const all = await readAll();
  return all.filter((e) => normalizePostcode(e.postcode) === norm);
}

/** Add or update an address in the directory (called by the local refresh script). */
export async function upsertAddress(entry: DirectoryEntry): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex(
    (e) => normalizePostcode(e.postcode) === normalizePostcode(entry.postcode) && e.pIndex === entry.pIndex,
  );
  if (idx === -1) all.push(entry);
  else all[idx] = entry;
  await writeAll(all);
}
