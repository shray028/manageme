import { BUNDLED_LEETCODE_SOURCES } from './sheets';
import { extractProblemSlugs, leetcodeKey, parseSource, problemUrl, titleFromSlug } from './leetcode';
import type { ImportResult } from './leetcode-import';
import type { SheetProblem } from './types';

async function callApi(url: string, timeoutMs = 45_000): Promise<ImportResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('The LeetCode lookup service is not available right now.');
    }
    if (!response.ok) throw new Error((data as { error?: string })?.error || 'LeetCode lookup failed.');
    return data as ImportResult;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw new Error('LeetCode took too long to answer.');
    throw error instanceof Error ? error : new Error('LeetCode lookup failed.');
  } finally {
    clearTimeout(timer);
  }
}

export type ProblemLookup = { problem: SheetProblem; verified: boolean };

/** Look up a LeetCode problem link. Falls back to a name built from the link if LeetCode can't be reached. */
export async function lookupProblem(slug: string, group: string): Promise<ProblemLookup> {
  try {
    const result = await callApi(problemUrl(slug), 15_000);
    if (result.kind === 'problem') return { problem: { ...result.problem, group }, verified: true };
  } catch {
    /* fall back below */
  }
  return { problem: { key: leetcodeKey(slug), title: titleFromSlug(slug), url: problemUrl(slug), group }, verified: false };
}

export type ImportOutcome =
  | { kind: 'sheet'; sheetId: string }
  | { kind: 'list'; title: string; sourceUrl: string; problems: SheetProblem[]; warnings: string[] }
  | { kind: 'problem'; problem: SheetProblem; verified: boolean };

export async function importFromUrl(raw: string): Promise<ImportOutcome> {
  const source = parseSource(raw);
  if (!source) throw new Error('Paste a full link, like https://leetcode.com/explore/interview/card/top-interview-questions-easy/');
  if (source.kind === 'card' || source.kind === 'studyplan') {
    const bundled = BUNDLED_LEETCODE_SOURCES[`${source.kind}:${source.slug}`];
    if (bundled) return { kind: 'sheet', sheetId: bundled };
  }
  if (source.kind === 'problem') {
    const lookup = await lookupProblem(source.slug, 'Added by me');
    return { kind: 'problem', ...lookup };
  }
  if (source.kind === 'other') throw new Error('Only LeetCode lists can be imported from a link. You can paste LeetCode problem links below instead.');
  if (source.kind === 'unsupported-leetcode')
    throw new Error('This kind of LeetCode page can’t be imported. Use an Explore card or a study plan link, or paste the problem links below.');
  const result = await callApi(raw);
  if (result.kind !== 'list') throw new Error('That link is a single problem, not a list.');
  return result;
}

/** Turn pasted text full of LeetCode links into problems, looking each one up (a few at a time). */
export async function problemsFromText(text: string, group: string, onProgress?: (done: number, total: number) => void) {
  const slugs = extractProblemSlugs(text).slice(0, 300);
  const results: ProblemLookup[] = new Array(slugs.length);
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < slugs.length) {
      const index = cursor++;
      results[index] = await lookupProblem(slugs[index], group);
      done += 1;
      onProgress?.(done, slugs.length);
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  return results;
}
