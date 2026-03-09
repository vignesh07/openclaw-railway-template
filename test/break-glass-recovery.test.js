import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRecoveryBackupPlan } from '../src/lib/break-glass-recovery.js';

test('break-glass recovery prefers native backup-and-verify flow first', () => {
  const plan = buildRecoveryBackupPlan('/data/.openclaw/openclaw.json');
  assert.equal(plan.preferred.kind, 'openclaw-backup');
  assert.equal(plan.preferred.requiresVerification, true);
  assert.equal(plan.preferred.configOnlyPreferred, true);
});

test('break-glass recovery includes local fallback copy plan', () => {
  const plan = buildRecoveryBackupPlan('/data/.openclaw/openclaw.json');
  assert.equal(plan.fallback.kind, 'file-copy');
});

test('server keeps break-glass separate and recovery-only', () => {
  const src = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(src, /\/setup\/api\/recovery\/break-glass/);
  assert.match(src, /buildRecoveryBackupPlan/);
  assert.match(src, /appendAuditEvent/);
  assert.match(src, /Recovery-only break-glass path/);
});
