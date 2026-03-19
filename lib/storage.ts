import fs from 'node:fs/promises';
import path from 'node:path';
import { del, head, put } from '@vercel/blob';
import type { DivisionScout } from '@/lib/types';

const DATA_PATH = path.join(process.cwd(), 'data', 'latest.json');
const BLOB_PATH = 'cache/latest.json';

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function isVercelProduction(): boolean {
  return Boolean(process.env.VERCEL);
}

async function readLocal(): Promise<DivisionScout | null> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    return validatePayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeLocal(payload: DivisionScout): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

async function readBlob(): Promise<DivisionScout | null> {
  try {
    const info = await head(BLOB_PATH);
    const response = await fetch(info.url, { cache: 'no-store' });
    if (!response.ok) return null;
    return validatePayload(await response.json());
  } catch {
    return null;
  }
}

async function writeBlob(payload: DivisionScout): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(payload, null, 2), {
    access: 'public',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

function validatePayload(parsed: unknown): DivisionScout | null {
  if (!parsed || typeof parsed !== 'object') return null;
  if (!('teams' in parsed) || !Array.isArray((parsed as { teams?: unknown[] }).teams)) return null;
  if (!('lastUpdated' in parsed) || !(parsed as { lastUpdated?: string | null }).lastUpdated) return null;
  return parsed as DivisionScout;
}

export async function readCachedDivision(): Promise<DivisionScout | null> {
  if (blobEnabled()) return readBlob();
  if (isVercelProduction()) return null;
  return readLocal();
}

export async function writeCachedDivision(payload: DivisionScout): Promise<void> {
  if (blobEnabled()) {
    await writeBlob(payload);
    return;
  }

  if (isVercelProduction()) {
    throw new Error('Missing BLOB_READ_WRITE_TOKEN. Connect Vercel Blob to this project and redeploy.');
  }

  await writeLocal(payload);
}

export async function clearCachedDivision(): Promise<void> {
  if (blobEnabled()) {
    try {
      await del(BLOB_PATH);
    } catch {}
    return;
  }

  if (isVercelProduction()) return;

  try {
    await fs.unlink(DATA_PATH);
  } catch {}
}
