import { describe, expect, it } from 'vitest';
import { buildBackup, planRestore } from '@/lib/dsa/backup';
import { groupProblems, isDueForRevision, listProblems, toList, toProgress, effectiveLinks } from '@/lib/dsa/model';
import { getSheet } from '@/lib/dsa/sheets';

const DAY = 86_400_000;

describe('toProgress', () => {
  it('survives corrupt or hostile stored data', () => {
    const progress = toProgress('p', {
      completed: 'yes',
      code: 42,
      language: 'brainfuck',
      links: [{ label: 'x', url: 'javascript:alert(1)' }, { label: 'ok', url: 'https://youtu.be/a' }, 'junk'],
      revisionCount: -3,
    });
    expect(progress.completed).toBe(false);
    expect(progress.code).toBe('');
    expect(progress.language).toBe('python');
    expect(progress.links).toEqual([{ id: 'link-1', label: 'ok', url: 'https://youtu.be/a' }]);
    expect(progress.revisionCount).toBe(0);
  });

  it('distinguishes "never edited links" (use defaults) from "removed all links"', () => {
    const problem = getSheet('strivers-180')!.problems[0];
    expect(effectiveLinks(toProgress('p', {}), problem)).toHaveLength(1);
    expect(effectiveLinks(toProgress('p', { links: [] }), problem)).toHaveLength(0);
  });
});

describe('lists', () => {
  it('shows sheet problems plus additions, minus hidden ones, without duplicates', () => {
    const list = toList('l1', {
      title: 'Mine',
      source: { kind: 'sheet', sheetId: 'leetcode-top-interview-easy' },
      extraProblems: [
        { key: 'two-sum', title: 'Two Sum (dup)', group: 'Mine' },
        { key: 'lru-cache', title: 'LRU Cache', url: 'https://leetcode.com/problems/lru-cache/', group: 'Added by me' },
        { key: 'bad', title: 'Bad link', url: 'javascript:alert(1)', group: 'x' },
      ],
      hiddenKeys: ['rotate-array'],
    })!;
    const problems = listProblems(list);
    expect(problems).toHaveLength(48 - 1 + 2);
    expect(problems.find((p) => p.key === 'two-sum')!.title).toBe('Two Sum');
    expect(problems.find((p) => p.key === 'bad')!.url).toBeNull();
  });

  it('groups by topic or by difficulty', () => {
    const problems = getSheet('leetcode-top-interview-easy')!.problems;
    expect(groupProblems(problems, 'group')[0].title).toBe('Array');
    const byDifficulty = groupProblems(problems, 'difficulty');
    expect(byDifficulty.map((g) => g.title)).toEqual(['Easy', 'Medium']);
    expect(byDifficulty[0].subgroups[0].title).toBe('Array');
    const striver = groupProblems(getSheet('strivers-180')!.problems, 'group');
    expect(striver[0]).toMatchObject({ title: 'Arrays' });
    expect(striver[0].subgroups.map((s) => s.title)).toEqual(['Linear Scan', 'Two Pointers', 'Divide and Conquer']);
  });

  it('flags problems for revision two days after solving', () => {
    const now = Date.now();
    expect(isDueForRevision({ ...toProgress('p', {}), completed: true, completedAt: now - DAY }, now)).toBe(false);
    expect(isDueForRevision({ ...toProgress('p', {}), completed: true, completedAt: now - 2 * DAY }, now)).toBe(true);
    expect(isDueForRevision({ ...toProgress('p', {}), completed: true, completedAt: now - 3 * DAY, revised: true }, now)).toBe(false);
  });
});

describe('backup and restore', () => {
  const current = {
    dsaLists: {},
    dsaProgress: {
      a: { code: 'mine', completed: true, clientUpdatedAt: 100 },
      b: { code: '', mistake: '', clientUpdatedAt: 500 },
    },
  };

  it('round-trips and never deletes anything', () => {
    const backup = buildBackup({
      dsaLists: { l: { title: 'L', source: { kind: 'custom' }, clientUpdatedAt: 10 } },
      dsaProgress: {
        a: { code: 'older', clientUpdatedAt: 50 },
        b: { code: 'restored code', mistake: 'used < not <=', clientUpdatedAt: 400 },
        c: { code: 'new problem', clientUpdatedAt: 1 },
      },
    });
    const plan = planRestore(JSON.stringify(backup), current);
    const byId = Object.fromEntries(plan.changes.map((change) => [change.id, change.patch]));
    expect(byId.a).toBeUndefined(); // ours is newer and complete
    expect(byId.b).toEqual({ code: 'restored code', mistake: 'used < not <=' }); // fill empty fields only
    expect(byId.c).toMatchObject({ code: 'new problem' });
    expect(plan.lists).toBe(1);
    expect(plan.skipped).toBe(1);
  });

  it('rejects files that are not backups', () => {
    expect(() => planRestore('nope', current)).toThrow(/not valid JSON/);
    expect(() => planRestore('{"format":"other"}', current)).toThrow(/not a ManageMe DSA backup/);
  });
});
