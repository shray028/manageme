import { describe, expect, it } from 'vitest';
import { extractProblemSlugs, parseSource, safeDocId, titleFromSlug } from '@/lib/dsa/leetcode';
import { fetchCard, fetchProblem, fetchStudyPlan, ImportError, resolveUrl } from '@/lib/dsa/leetcode-import';
import { EXTRA_BUNDLED, SHEETS, getSheet, BUNDLED_LEETCODE_SOURCES } from '@/lib/dsa/sheets';

describe('parseSource', () => {
  it.each([
    ['https://leetcode.com/problems/two-sum/', { kind: 'problem', slug: 'two-sum' }],
    ['leetcode.com/problems/two-sum/description/?envType=x', { kind: 'problem', slug: 'two-sum' }],
    ['https://leetcode.com/explore/interview/card/top-interview-questions-easy/', { kind: 'card', slug: 'top-interview-questions-easy' }],
    ['https://leetcode.com/explore/interview/card/top-interview-questions-easy/92/array/727/', { kind: 'card', slug: 'top-interview-questions-easy' }],
    ['https://leetcode.com/studyplan/top-interview-150/', { kind: 'studyplan', slug: 'top-interview-150' }],
    ['https://www.youtube.com/watch?v=1', { kind: 'other', url: 'https://www.youtube.com/watch?v=1' }],
  ])('%s', (input, expected) => {
    expect(parseSource(input)).toEqual(expected);
  });

  it('rejects junk and unsafe schemes', () => {
    expect(parseSource('')).toBeNull();
    expect(parseSource('not a url')).toBeNull();
    expect(parseSource('javascript:alert(1)')).toBeNull();
  });

  it('flags LeetCode pages it cannot import', () => {
    expect(parseSource('https://leetcode.com/problemset/')).toEqual({ kind: 'unsupported-leetcode', path: '/problemset/' });
  });
});

describe('helpers', () => {
  it('extracts every problem link from pasted text, once each, in order', () => {
    const text = `Day 1 https://leetcode.com/problems/two-sum/ and
      LEETCODE.com/problems/Valid-Anagram/description, again https://leetcode.com/problems/two-sum`;
    expect(extractProblemSlugs(text)).toEqual(['two-sum', 'valid-anagram']);
  });

  it('builds readable titles from slugs', () => {
    expect(titleFromSlug('best-time-to-buy-and-sell-stock-ii')).toBe('Best Time to Buy and Sell Stock II');
    expect(titleFromSlug('lru-cache')).toBe('LRU Cache');
  });

  it('makes Firestore-safe document ids', () => {
    expect(safeDocId('a/b')).toBe('a-b');
    expect(safeDocId('..')).toBe('problem');
    expect(safeDocId("tuf:kadane's-algorithm")).toBe("tuf:kadane's-algorithm");
    expect(safeDocId('x'.repeat(500))).toHaveLength(200);
  });
});

describe('bundled sheets', () => {
  const all = [...SHEETS, ...EXTRA_BUNDLED];
  it('match the source sizes', () => {
    expect(getSheet('leetcode-top-interview-easy')!.problems).toHaveLength(48);
    expect(getSheet('strivers-180')!.problems).toHaveLength(179);
    expect(getSheet('leetcode-top-interview-medium')!.problems.length).toBeGreaterThan(40);
  });

  it.each(all.map((sheet) => [sheet.id, sheet]))('%s has unique keys and safe links', (_id, sheet) => {
    const keys = sheet.problems.map((problem) => problem.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const problem of sheet.problems) {
      expect(problem.title.length).toBeGreaterThan(0);
      expect(problem.group.length).toBeGreaterThan(0);
      expect(safeDocId(problem.key)).toBe(problem.key);
      if (problem.url) expect(problem.url).toMatch(/^https:\/\//);
      for (const link of problem.defaultLinks ?? []) expect(link.url).toMatch(/^https:\/\/(www\.)?(youtu\.be|youtube\.com)\//);
    }
  });

  it('keeps Striver’s two cycle-detection problems separate even though they share a LeetCode link', () => {
    const striver = getSheet('strivers-180')!;
    const cycle = striver.problems.filter((problem) => problem.url === 'https://leetcode.com/problems/course-schedule/');
    expect(cycle).toHaveLength(2);
    expect(cycle[0].key).not.toBe(cycle[1].key);
  });

  it('attaches Striver’s video as a default reference link', () => {
    const kadane = getSheet('strivers-180')!.problems.find((problem) => problem.title === "Kadane's Algorithm")!;
    expect(kadane.defaultLinks?.[0]).toMatchObject({ url: 'https://youtu.be/AHZpyENo7k4' });
    expect(kadane.key).toBe('maximum-subarray');
  });

  it('maps every bundled LeetCode source to a real sheet', () => {
    for (const id of Object.values(BUNDLED_LEETCODE_SOURCES)) expect(getSheet(id)).toBeTruthy();
  });
});

// ---- server import, with a fake LeetCode ---------------------------------------------------

type Handler = (body: { query: string; variables: Record<string, unknown> }) => unknown;
function fakeFetch(handler: Handler, options: { status?: number; raw?: string } = {}) {
  return async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (options.raw) return new Response(options.raw, { status: options.status ?? 200 });
    return new Response(JSON.stringify(handler(body)), { status: options.status ?? 200 });
  };
}

describe('LeetCode import', () => {
  it('looks up a single problem', async () => {
    const result = await fetchProblem(
      fakeFetch(() => ({ data: { question: { questionFrontendId: '1', title: 'Two Sum', titleSlug: 'two-sum', difficulty: 'Easy', isPaidOnly: false } } })),
      'two-sum',
    );
    expect(result.problem).toMatchObject({ key: 'two-sum', number: '1', title: 'Two Sum', difficulty: 'Easy', url: 'https://leetcode.com/problems/two-sum/' });
  });

  it('reads a study plan (uppercase difficulty, grouped)', async () => {
    const result = await fetchStudyPlan(
      fakeFetch(() => ({
        data: {
          studyPlanV2Detail: {
            name: 'Top Interview 150',
            planSubGroups: [{ name: 'Array / String', questions: [{ titleSlug: 'merge-sorted-array', title: 'Merge Sorted Array', questionFrontendId: '88', difficulty: 'EASY', paidOnly: false }] }],
          },
        },
      })),
      'top-interview-150',
    );
    expect(result.title).toBe('Top Interview 150');
    expect(result.problems[0]).toMatchObject({ group: 'Array / String', difficulty: 'Easy', number: '88' });
  });

  it('reads an Explore card item by item and keeps premium items by title', async () => {
    const fetchImpl = fakeFetch(({ variables }) => {
      if ('s' in variables)
        return {
          data: {
            card: { title: 'Top Interview Questions' },
            chapters: [
              { title: 'Array', items: [{ id: '727', title: 'Remove Duplicates from Sorted Array', type: 1 }, { id: '9', title: 'Intro article', type: 0 }, { id: '999', title: 'Meeting Rooms II', type: 1 }] },
            ],
          },
        };
      if (variables.id === '727') return { data: { item: { question: { questionFrontendId: '26', title: 'Remove Duplicates from Sorted Array', titleSlug: 'remove-duplicates-from-sorted-array', difficulty: 'Easy' } } } };
      return { data: { item: { question: null } } };
    });
    const result = await fetchCard(fetchImpl, 'top-interview-questions-easy');
    expect(result.problems.map((p) => p.key)).toEqual(['remove-duplicates-from-sorted-array', 'meeting-rooms-ii']);
    expect(result.warnings[0]).toMatch(/1 problem could not be looked up/);
  });

  it('turns LeetCode blocking (HTML page) into a clear error', async () => {
    await expect(fetchProblem(fakeFetch(() => null, { raw: '<!DOCTYPE html><html>' }), 'two-sum')).rejects.toThrow(/unexpected/);
  });

  it('turns HTTP errors into clear errors', async () => {
    await expect(fetchProblem(fakeFetch(() => ({}), { status: 403 }), 'two-sum')).rejects.toThrow(/403/);
  });

  it('refuses non-LeetCode and unsupported links without calling out', async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response('{}');
    };
    await expect(resolveUrl(fetchImpl, 'https://example.com/x')).rejects.toBeInstanceOf(ImportError);
    await expect(resolveUrl(fetchImpl, 'https://leetcode.com/problemset/')).rejects.toThrow(/can’t be imported/);
    await expect(resolveUrl(fetchImpl, 42)).rejects.toThrow(/paste a link/);
    expect(called).toBe(false);
  });

  it('ignores malformed slugs coming back from LeetCode', async () => {
    await expect(
      fetchProblem(fakeFetch(() => ({ data: { question: { title: 'x', titleSlug: '../../etc' } } })), 'two-sum'),
    ).rejects.toThrow(/unexpected problem format/);
  });
});
