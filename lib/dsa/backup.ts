import { safeDocId } from './leetcode';
import { toList, toProgress } from './model';
import type { Collection, Doc } from './sync';
import { TEXT_FIELDS } from './types';

export const BACKUP_FORMAT = 'manageme-dsa-backup';

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  account?: string;
  dsaLists: Record<string, Doc>;
  dsaProgress: Record<string, Doc>;
};

export function buildBackup(snapshot: Record<Collection, Record<string, Doc>>, account?: string): Backup {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    ...(account ? { account } : {}),
    dsaLists: snapshot.dsaLists ?? {},
    dsaProgress: snapshot.dsaProgress ?? {},
  };
}

export type RestorePlan = {
  changes: Array<{ collection: Collection; id: string; patch: Doc }>;
  lists: number;
  problems: number;
  skipped: number;
};

const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

/**
 * Work out what restoring a backup would change. Restoring never deletes anything:
 *  - a backup entry newer than what you have now replaces it;
 *  - otherwise, only empty fields are filled in from the backup.
 */
export function planRestore(raw: string, current: Record<Collection, Record<string, Doc>>): RestorePlan {
  let parsed: Partial<Backup>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('That file is not a ManageMe backup (it is not valid JSON).');
  }
  if (parsed?.format !== BACKUP_FORMAT || parsed.version !== 1) throw new Error('That file is not a ManageMe DSA backup.');
  const plan: RestorePlan = { changes: [], lists: 0, problems: 0, skipped: 0 };

  for (const [rawId, doc] of Object.entries(parsed.dsaProgress ?? {})) {
    const id = safeDocId(rawId);
    const incoming = toProgress(id, doc as Doc);
    const existingDoc = current.dsaProgress?.[id];
    if (!existingDoc) {
      const { key: _key, ...rest } = incoming;
      plan.changes.push({ collection: 'dsaProgress', id, patch: rest });
      plan.problems += 1;
      continue;
    }
    const existing = toProgress(id, existingDoc);
    if (incoming.clientUpdatedAt > existing.clientUpdatedAt) {
      const { key: _key, ...rest } = incoming;
      plan.changes.push({ collection: 'dsaProgress', id, patch: rest });
      plan.problems += 1;
      continue;
    }
    const patch: Doc = {};
    for (const field of TEXT_FIELDS) if (!hasText(existing[field]) && hasText(incoming[field])) patch[field] = incoming[field];
    if (!existing.links?.length && incoming.links?.length) patch.links = incoming.links;
    if (!existing.completed && incoming.completed) Object.assign(patch, { completed: true, completedAt: incoming.completedAt });
    if (!existing.revised && incoming.revised) Object.assign(patch, { revised: true, revisedAt: incoming.revisedAt, revisionCount: incoming.revisionCount });
    if (!existing.bookmarked && incoming.bookmarked) patch.bookmarked = true;
    if (Object.keys(patch).length) {
      plan.changes.push({ collection: 'dsaProgress', id, patch });
      plan.problems += 1;
    } else plan.skipped += 1;
  }

  for (const [rawId, doc] of Object.entries(parsed.dsaLists ?? {})) {
    const id = safeDocId(rawId);
    const incoming = toList(id, doc as Doc);
    if (!incoming) continue;
    const existing = toList(id, current.dsaLists?.[id]);
    if (existing && existing.updatedAt >= incoming.updatedAt) {
      plan.skipped += 1;
      continue;
    }
    const { id: _id, updatedAt: _updated, ...rest } = incoming;
    plan.changes.push({ collection: 'dsaLists', id, patch: rest });
    plan.lists += 1;
  }
  return plan;
}
