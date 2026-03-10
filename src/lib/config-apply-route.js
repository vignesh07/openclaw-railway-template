import { appendAuditEvent } from './config-audit-log.js';
import { buildMutationRequest } from './config-ops.js';
import { validateSemanticConfig } from './config-semantic-checks.js';
import { summarizeWorkerActivity } from './worker-activity.js';

function parseCandidateConfig(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function applyMergePatch(target, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    return patch;
  }

  const base = target && typeof target === 'object' && !Array.isArray(target) ? target : {};
  const result = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete result[key];
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = applyMergePatch(base[key], value);
      continue;
    }

    result[key] = value;
  }

  return result;
}

function patchTouchesArray(value) {
  if (Array.isArray(value)) return true;
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some((entry) => patchTouchesArray(entry));
}

export function createRawConfigWriteDisabledHandler() {
  return (_req, res) => {
    return res.status(410).json({
      ok: false,
      error: 'Raw config writes disabled. Use /setup/api/config/apply.',
      code: 'GONE',
    });
  };
}

export function createConfigApplyHandler({
  loadPolicy,
  fetchCurrentConfigState,
  runConfigMutation,
  listActiveWorkerSessions,
  appendAuditEvent: appendAuditEventImpl = appendAuditEvent,
  checkPostApplyHealth = async () => ({ ok: false, reason: 'Post-apply health checks not implemented yet' }),
  enterSafeMode = async () => ({ ok: false, reason: 'Safe mode not implemented yet' }),
  mutex,
  auditLogPath,
} = {}) {
  return async function configApplyHandler(req, res) {
    const payload = req.body || {};
    const type = payload.type === 'full' ? 'full' : payload.type === 'partial' ? 'partial' : null;
    const raw = String(payload.raw || '').trim();
    const force = payload.force === true;
    const note = payload.note == null ? null : String(payload.note);
    const sessionKey = payload.sessionKey == null ? 'main' : String(payload.sessionKey);
    const restartDelayMs = payload.restartDelayMs == null ? 2000 : payload.restartDelayMs;

    if (!type || !raw) {
      return res.status(400).json({ ok: false, error: 'Invalid apply request' });
    }

    let release = () => {};
    if (mutex) {
      try {
        release = await mutex.acquire();
      } catch (error) {
        return res.status(409).json({ ok: false, error: String(error) });
      }
    }

    try {
      let currentState;
      try {
        currentState = await fetchCurrentConfigState();
      } catch (error) {
        return res.status(503).json({ ok: false, error: 'Current config unavailable', details: String(error) });
      }

      const currentPayload = currentState?.payload ?? {};
      const baseHash = currentState?.hash;
      if (baseHash == null || baseHash === '') {
        return res.status(503).json({ ok: false, error: 'Current config hash unavailable' });
      }

      const parsedCandidate = parseCandidateConfig(raw);
      if (!parsedCandidate.ok) {
        return res.status(400).json({ ok: false, error: 'Invalid JSON payload', details: parsedCandidate.error });
      }

      let policy;
      try {
        policy = await loadPolicy();
      } catch (error) {
        return res.status(503).json({ ok: false, error: 'Control-plane policy unavailable', details: String(error) });
      }

      if (!policy) {
        return res.status(503).json({ ok: false, error: 'Control-plane policy unavailable' });
      }

      const candidateConfig = type === 'full'
        ? parsedCandidate.value
        : applyMergePatch(currentPayload, parsedCandidate.value);

      const semantic = validateSemanticConfig(candidateConfig, policy);
      if (!semantic.ok) {
        return res.status(422).json({ ok: false, error: 'Semantic validation failed', errors: semantic.errors });
      }

      let workerSessions;
      try {
        workerSessions = await listActiveWorkerSessions();
      } catch (error) {
        return res.status(503).json({ ok: false, error: 'Worker activity unavailable', details: String(error) });
      }

      const workerSummary = summarizeWorkerActivity(workerSessions);
      if (workerSummary.blocked && !force) {
        await appendAuditEventImpl(auditLogPath, {
          event: 'apply_blocked_active_workers',
          force,
          baseHash,
          notes: note,
          actor: sessionKey,
          activeWorkerCount: workerSummary.count,
          result: 'blocked',
        });
        return res.status(409).json({
          ok: false,
          error: 'Active workers present; force required',
          activeWorkerCount: workerSummary.count,
          sessionKeys: workerSummary.sessionKeys,
        });
      }

      const request = buildMutationRequest({ type, raw, baseHash, sessionKey, note, restartDelayMs });
      const diff = {
        type,
        baseHash,
        arrayReplacementNotice: patchTouchesArray(parsedCandidate.value),
      };

      await appendAuditEventImpl(auditLogPath, {
        event: 'apply_requested',
        force,
        baseHash,
        notes: note,
        actor: sessionKey,
        activeWorkerCount: workerSummary.count,
        result: 'requested',
      });

      let mutationResult;
      try {
        mutationResult = await runConfigMutation({
          change: { type, raw, baseHash },
          note,
          sessionKey,
          restartDelayMs,
        });
      } catch (error) {
        await appendAuditEventImpl(auditLogPath, {
          event: 'apply_failed',
          force,
          baseHash,
          notes: note,
          actor: sessionKey,
          activeWorkerCount: workerSummary.count,
          result: String(error),
        });
        if (error?.retryAfterMs != null) {
          return res.status(429).json({ ok: false, error: String(error), retryAfterMs: error.retryAfterMs });
        }
        if (/base[- ]?hash/i.test(String(error))) {
          return res.status(409).json({ ok: false, error: String(error) });
        }
        return res.status(503).json({ ok: false, error: String(error) });
      }

      const health = await checkPostApplyHealth({
        policy,
        candidateConfig,
        mutationResult,
        currentState,
      });

      if (!health?.ok) {
        try {
          const rollbackState = await fetchCurrentConfigState();
          await runConfigMutation({
            change: {
              type: 'full',
              raw: JSON.stringify(currentPayload),
              baseHash: rollbackState?.hash ?? mutationResult?.hash ?? baseHash,
            },
            note: 'rollback',
            sessionKey,
            restartDelayMs,
          });
          await appendAuditEventImpl(auditLogPath, {
            event: 'apply_rollback',
            force,
            baseHash,
            candidateHash: mutationResult?.hash ?? null,
            notes: note,
            actor: sessionKey,
            activeWorkerCount: workerSummary.count,
            result: health?.reason ?? 'post-apply health failed',
          });
          await appendAuditEventImpl(auditLogPath, {
            event: 'apply_failed',
            force,
            baseHash,
            candidateHash: mutationResult?.hash ?? null,
            notes: note,
            actor: sessionKey,
            activeWorkerCount: workerSummary.count,
            result: 'rolled_back',
          });
          return res.status(500).json({
            ok: false,
            error: 'Post-apply health failed; rollback applied',
            health,
            rolledBack: true,
            diff,
          });
        } catch (rollbackError) {
          await appendAuditEventImpl(auditLogPath, {
            event: 'apply_rollback_failed',
            force,
            baseHash,
            candidateHash: mutationResult?.hash ?? null,
            notes: note,
            actor: sessionKey,
            activeWorkerCount: workerSummary.count,
            result: String(rollbackError),
          });
          await enterSafeMode({ reason: String(rollbackError) });
          return res.status(500).json({
            ok: false,
            error: 'Post-apply health failed and rollback failed',
            health,
            rollbackError: String(rollbackError),
          });
        }
      }

      await appendAuditEventImpl(auditLogPath, {
        event: 'apply_succeeded',
        force,
        baseHash,
        candidateHash: mutationResult?.hash ?? null,
        notes: note,
        actor: sessionKey,
        activeWorkerCount: workerSummary.count,
        result: 'succeeded',
      });

      return res.status(200).json({
        ok: true,
        request,
        diff,
        workerSummary,
        result: mutationResult,
      });
    } finally {
      release();
    }
  };
}
