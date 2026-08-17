import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { CollectionEvent } from './councilScraper';

export interface StoredSchedule {
  postcode: string;
  pIndex: string;
  addressLabel: string;
  events: CollectionEvent[];
  fetchedAt: string; // ISO datetime
}

function keyFor(postcode: string, pIndex: string): string {
  const slug = postcode.trim().toUpperCase().replace(/\s+/g, '');
  return `schedules/${slug}-${pIndex}.json`;
}

const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const LOCAL_DIR = path.join(process.cwd(), '.data');

async function readLocal(key: string): Promise<StoredSchedule | null> {
  try {
    const raw = await readFile(path.join(LOCAL_DIR, key.replace('/', '_')), 'utf8');
    return JSON.parse(raw) as StoredSchedule;
  } catch {
    return null;
  }
}

async function writeLocal(key: string, data: StoredSchedule): Promise<void> {
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, key.replace('/', '_')), JSON.stringify(data, null, 2), 'utf8');
}

export async function readCachedSchedule(postcode: string, pIndex: string): Promise<StoredSchedule | null> {
  const key = keyFor(postcode, pIndex);
  if (!USE_BLOB) return readLocal(key);

  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: key, limit: 1 });
  if (blobs.length === 0) return null;
  const res = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as StoredSchedule;
}

export async function writeCachedSchedule(data: StoredSchedule): Promise<void> {
  const key = keyFor(data.postcode, data.pIndex);
  if (!USE_BLOB) {
    await writeLocal(key, data);
    return;
  }

  const { put } = await import('@vercel/blob');
  await put(key, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
