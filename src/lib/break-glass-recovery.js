export function buildRecoveryBackupPlan(configPath) {
  return {
    preferred: {
      kind: 'openclaw-backup',
      commandFamily: 'openclaw backup',
      configOnlyPreferred: true,
      requiresVerification: true,
      notes: 'Preferred when CLI/runtime support is confirmed; avoids inventing a second backup format.',
    },
    fallback: {
      kind: 'file-copy',
      targetPath: configPath,
      notes: 'Only for last-resort local recovery when native recovery path is unavailable.',
    },
  };
}
