import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplyMutex } from '../src/lib/apply-mutex.js';

test('second acquire fails while first lock is held', async () => {
  const mutex = createApplyMutex();
  const release = await mutex.acquire();
  await assert.rejects(() => mutex.acquire(), /apply already in progress/);
  release();
});
