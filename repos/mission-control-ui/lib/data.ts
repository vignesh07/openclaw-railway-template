import fs from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import type { IndexItem, QueueFile, ReviewRecord, SourceFile } from './types';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '/data/workspace';
const STATE_DIR = path.join(WORKSPACE_ROOT, 'agents/mission-control/state');
const REVIEWS_DIR = path.join(STATE_DIR, 'reviews');
const INDEX_PATH = path.join(STATE_DIR, 'index.json');
const INTEL_DIR = path.join(WORKSPACE_ROOT, 'intel');
const DATA_DIR = path.join(INTEL_DIR, 'data');
const QUEUE_DIR = path.join(INTEL_DIR, 'postpone-queue');

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function classifySourceFile(name: string): SourceFile['kind'] {
  if (name.includes('curated-feed')) return 'curated_feed';
  if (name.includes('reference')) return 'vibe_reference';
  if (name.includes('@') || name.includes('jimmy') || name.includes('lennox') || name.includes('hussein')) return 'target_scrape';
  return 'other';
}

function safePreview(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
}

export const getIndexItems = cache(async (): Promise<IndexItem[]> => {
  const data = await readJsonFile<{ items: IndexItem[] }>(INDEX_PATH);
  return [...(data.items || [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
});

export const getReviewRecord = cache(async (recordId: string): Promise<ReviewRecord | null> => {
  const filePath = path.join(REVIEWS_DIR, `${recordId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJsonFile<ReviewRecord>(filePath);
});

export const getAllReviewRecords = cache(async (): Promise<ReviewRecord[]> => {
  const entries = await fs.readdir(REVIEWS_DIR);
  const jsonFiles = entries.filter((entry) => entry.endsWith('.json')).sort();
  const records = await Promise.all(jsonFiles.map((file) => readJsonFile<ReviewRecord>(path.join(REVIEWS_DIR, file))));
  return records.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
});

export const getSourceFiles = cache(async (): Promise<SourceFile[]> => {
  const entries = await fs.readdir(DATA_DIR);
  const files = await Promise.all(
    entries
      .filter((entry) => entry.endsWith('.json'))
      .map(async (name) => {
        const filePath = path.join(DATA_DIR, name);
        const [stat, data] = await Promise.all([fs.stat(filePath), readJsonFile<unknown>(filePath)]);
        return {
          name,
          path: path.relative(WORKSPACE_ROOT, filePath),
          kind: classifySourceFile(name),
          modifiedAt: stat.mtime.toISOString(),
          preview: safePreview(data),
        } satisfies SourceFile;
      }),
  );
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
});

export const getQueueFiles = cache(async (): Promise<QueueFile[]> => {
  try {
    const entries = await fs.readdir(QUEUE_DIR);
    const files = await Promise.all(
      entries
        .filter((entry) => entry.endsWith('.json'))
        .map(async (name) => {
          const filePath = path.join(QUEUE_DIR, name);
          const [stat, raw] = await Promise.all([fs.stat(filePath), fs.readFile(filePath, 'utf8')]);
          return {
            name,
            path: path.relative(WORKSPACE_ROOT, filePath),
            modifiedAt: stat.mtime.toISOString(),
            preview: safePreview(raw),
          } satisfies QueueFile;
        }),
    );
    return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  } catch {
    return [];
  }
});

export async function updateReviewStatus(input: {
  recordId: string;
  action: 'approve' | 'revise' | 'reject';
  feedback: string;
  reviewer: string;
}) {
  const reviewPath = path.join(REVIEWS_DIR, `${input.recordId}.json`);
  const current = await readJsonFile<ReviewRecord>(reviewPath);
  const now = new Date().toISOString();
  const nextStatus = input.action === 'approve' ? 'approved' : input.action === 'reject' ? 'rejected' : 'revise';

  const nextReview: ReviewRecord = {
    ...current,
    status: nextStatus,
    updated_at: now,
    review: {
      latest_feedback: input.feedback || null,
      latest_reviewer: input.reviewer || 'mission-control-ui',
      latest_action_at: now,
    },
    history: [
      ...(current.history || []),
      {
        at: now,
        action: input.action,
        status: nextStatus,
        reviewer: input.reviewer || 'mission-control-ui',
        feedback: input.feedback || '',
      },
    ],
  };

  await fs.writeFile(reviewPath, `${JSON.stringify(nextReview, null, 2)}\n`, 'utf8');

  const index = await readJsonFile<{ items: IndexItem[]; updated_at?: string }>(INDEX_PATH);
  index.items = (index.items || []).map((item) =>
    item.record_id === input.recordId
      ? {
          ...item,
          status: nextStatus,
          updated_at: now,
        }
      : item,
  );
  index.updated_at = now;
  await fs.writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}
