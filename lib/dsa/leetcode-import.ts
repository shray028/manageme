/**
 * Server-side LeetCode lookups (used by /api/leetcode). Kept free of framework code so it can be
 * unit-tested with a fake fetch. Every response is validated and normalised before it reaches the
 * browser, and every failure becomes a clear, human message instead of a crash.
 */
import { normaliseDifficulty, parseSource, problemUrl, leetcodeKey, titleFromSlug } from './leetcode';
import type { SheetProblem } from './types';

export type ImportedList = { kind: 'list'; title: string; sourceUrl: string; problems: SheetProblem[]; warnings: string[] };
export type ImportedProblem = { kind: 'problem'; problem: SheetProblem };
export type ImportResult = ImportedList | ImportedProblem;

export class ImportError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const ENDPOINT = 'https://leetcode.com/graphql/';
const MAX_ITEMS = 400;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isString = (value: unknown): value is string => typeof value === 'string';
const cleanText = (value: unknown, max = 300) => (isString(value) ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export async function graphql<T>(fetchImpl: FetchLike, query: string, variables: Record<string, unknown>, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        referer: 'https://leetcode.com/',
        origin: 'https://leetcode.com',
        'user-agent': 'Mozilla/5.0 (compatible; ManageMe/1.0; +https://github.com/shray028/manageme)',
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    throw new ImportError(
      (error as Error)?.name === 'AbortError' ? 'LeetCode took too long to respond.' : 'LeetCode could not be reached right now.',
      502,
    );
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  if (!response.ok) throw new ImportError(`LeetCode answered with an error (${response.status}).`, 502);
  let parsed: { data?: T; errors?: Array<{ message?: string }> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError('LeetCode returned something unexpected (it may be blocking automated requests).', 502);
  }
  if (!parsed.data) throw new ImportError(parsed.errors?.[0]?.message ? `LeetCode: ${parsed.errors[0].message}` : 'LeetCode returned no data.', 502);
  return parsed.data;
}

type RawQuestion = { questionFrontendId?: unknown; title?: unknown; titleSlug?: unknown; difficulty?: unknown; isPaidOnly?: unknown; paidOnly?: unknown };

function toProblem(question: RawQuestion, group: string): SheetProblem | null {
  const slug = cleanText(question.titleSlug, 200).toLowerCase();
  if (!slugPattern.test(slug)) return null;
  const number = cleanText(question.questionFrontendId, 10);
  return {
    key: leetcodeKey(slug),
    title: cleanText(question.title) || titleFromSlug(slug),
    url: problemUrl(slug),
    ...(number ? { number } : {}),
    ...(normaliseDifficulty(question.difficulty) ? { difficulty: normaliseDifficulty(question.difficulty) } : {}),
    ...(question.isPaidOnly === true || question.paidOnly === true ? { tier: 'Premium' } : {}),
    group,
  };
}

export async function fetchProblem(fetchImpl: FetchLike, slug: string): Promise<ImportedProblem> {
  if (!slugPattern.test(slug)) throw new ImportError('That does not look like a LeetCode problem link.');
  const data = await graphql<{ question: RawQuestion | null }>(
    fetchImpl,
    'query problem($s: String!) { question(titleSlug: $s) { questionFrontendId title titleSlug difficulty isPaidOnly } }',
    { s: slug },
  );
  if (!data.question) throw new ImportError('LeetCode has no problem at that link.', 404);
  const problem = toProblem(data.question, 'Added by me');
  if (!problem) throw new ImportError('LeetCode returned an unexpected problem format.', 502);
  return { kind: 'problem', problem };
}

export async function fetchStudyPlan(fetchImpl: FetchLike, slug: string): Promise<ImportedList> {
  const data = await graphql<{
    studyPlanV2Detail: { name?: unknown; planSubGroups?: Array<{ name?: unknown; questions?: RawQuestion[] }> } | null;
  }>(
    fetchImpl,
    'query plan($s: String!) { studyPlanV2Detail(planSlug: $s) { name planSubGroups { name questions { titleSlug title questionFrontendId difficulty paidOnly } } } }',
    { s: slug },
  );
  const plan = data.studyPlanV2Detail;
  if (!plan || !Array.isArray(plan.planSubGroups)) throw new ImportError('LeetCode has no study plan at that link.', 404);
  const problems: SheetProblem[] = [];
  for (const group of plan.planSubGroups) {
    const name = cleanText(group.name) || 'Problems';
    for (const question of group.questions ?? []) {
      const problem = toProblem(question, name);
      if (problem) problems.push(problem);
    }
  }
  if (!problems.length) throw new ImportError('That study plan has no problems we could read.', 404);
  return { kind: 'list', title: cleanText(plan.name) || titleFromSlug(slug), sourceUrl: `https://leetcode.com/studyplan/${slug}/`, problems: problems.slice(0, MAX_ITEMS), warnings: [] };
}

export async function fetchCard(fetchImpl: FetchLike, slug: string, options: { concurrency?: number; budgetMs?: number } = {}): Promise<ImportedList> {
  const data = await graphql<{
    card: { title?: unknown } | null;
    chapters: Array<{ title?: unknown; items?: Array<{ id?: unknown; title?: unknown; type?: unknown; paidOnly?: unknown }> }> | null;
  }>(fetchImpl, 'query card($s: String!) { card(cardSlug: $s) { title } chapters(cardSlug: $s) { title items { id title type paidOnly } } }', { s: slug });
  if (!data.chapters?.length) throw new ImportError('LeetCode has no Explore card at that link.', 404);

  type Job = { group: string; itemId: string; itemTitle: string; index: number };
  const jobs: Job[] = [];
  for (const chapter of data.chapters) {
    const group = cleanText(chapter.title) || 'Problems';
    for (const item of chapter.items ?? []) {
      // type 1 = question; other items are articles/videos.
      if (item.type !== 1 && item.type !== '1') continue;
      const itemId = cleanText(item.id, 20);
      if (!/^\d+$/.test(itemId)) continue;
      jobs.push({ group, itemId, itemTitle: cleanText(item.title), index: jobs.length });
    }
  }
  if (!jobs.length) throw new ImportError('That Explore card has no coding problems.', 404);
  const limited = jobs.slice(0, MAX_ITEMS);
  const results: Array<SheetProblem | null> = new Array(limited.length).fill(null);
  const warnings: string[] = [];
  const started = Date.now();
  const budget = options.budgetMs ?? 25_000;
  let cursor = 0;

  // LeetCode rejects batched (aliased) queries, so each item is looked up on its own, a few at a time.
  const worker = async () => {
    while (cursor < limited.length) {
      const job = limited[cursor++];
      if (Date.now() - started > budget) break;
      try {
        const item = await graphql<{ item: { question: RawQuestion | null } | null }>(
          fetchImpl,
          'query item($id: String!) { item(id: $id) { question { questionFrontendId title titleSlug difficulty isPaidOnly } } }',
          { id: job.itemId },
          6000,
        );
        results[job.index] = item.item?.question ? toProblem(item.item.question, job.group) : null;
      } catch {
        results[job.index] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: options.concurrency ?? 4 }, worker));

  const problems: SheetProblem[] = [];
  let guessed = 0;
  limited.forEach((job, index) => {
    const found = results[index];
    if (found) problems.push(found);
    else if (job.itemTitle) {
      // Premium or temporarily unavailable item: keep it in the list using its title.
      guessed += 1;
      const slug = job.itemTitle.toLowerCase().replace(/[()']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      problems.push({ key: leetcodeKey(slug || `item-${job.itemId}`), title: job.itemTitle, url: slug ? problemUrl(slug) : null, group: job.group });
    }
  });
  if (guessed) warnings.push(`${guessed} problem${guessed === 1 ? '' : 's'} could not be looked up (often Premium problems), so their links are best guesses.`);
  if (jobs.length > MAX_ITEMS) warnings.push(`Only the first ${MAX_ITEMS} problems were imported.`);
  return {
    kind: 'list',
    title: cleanText(data.card?.title) || titleFromSlug(slug),
    sourceUrl: `https://leetcode.com/explore/interview/card/${slug}/`,
    problems,
    warnings,
  };
}

export async function resolveUrl(fetchImpl: FetchLike, rawUrl: unknown): Promise<ImportResult> {
  if (!isString(rawUrl) || rawUrl.length > 2000) throw new ImportError('Please paste a link.');
  const source = parseSource(rawUrl);
  if (!source) throw new ImportError('That doesn’t look like a web link.');
  switch (source.kind) {
    case 'problem':
      return fetchProblem(fetchImpl, source.slug);
    case 'card':
      return fetchCard(fetchImpl, source.slug);
    case 'studyplan':
      return fetchStudyPlan(fetchImpl, source.slug);
    case 'unsupported-leetcode':
      throw new ImportError('This kind of LeetCode page can’t be imported yet. Use an Explore card, a study plan, or paste the problem links.');
    default:
      throw new ImportError('Only LeetCode links can be imported. You can still paste a list of LeetCode problem links.');
  }
}
