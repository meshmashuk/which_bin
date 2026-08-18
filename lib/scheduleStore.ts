import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { CollectionEvent } from './councilScraper';

export interface StoredSchedule {
  postcode: string;
  events: CollectionEvent[];
  fetchedAt: string; // ISO datetime
}

function keyFor(postcode: string): string {
  const slug = postcode.trim().toUpperCase().replace(/\s+/g, '');
  return `schedules/${slug}.json`;
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

export async function readCachedSchedule(postcode: string): Promise<StoredSchedule | null> {
  const key = keyFor(postcode);
  if (!USE_BLOB) return readLocal(key);

  const { get } = await import('@vercel/blob');
  const result = await get(key, { access: 'private' }).catch(() => null);
  if (!result?.stream) return null;
  const text = await new Response(result.stream).text();
  return JSON.parse(text) as StoredSchedule;
}

export async function writeCachedSchedule(data: StoredSchedule): Promise<void> {
  const key = keyFor(data.postcode);
  if (!USE_BLOB) {
    await writeLocal(key, data);
    return;
  }

  const { put } = await import('@vercel/blob');
  await put(key, JSON.stringify(data), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
