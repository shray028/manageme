import { getSheet } from './sheets';
import { safeDocId } from './leetcode';
import { emptyProgress, LIMITS, type Difficulty, type DsaList, type Language, type Progress, type RefLink, type SheetProblem } from './types';
import type { Doc } from './sync';

const LANGUAGES: Language[] = ['python', 'java', 'cpp', 'javascript', 'typescript', 'go', 'text'];
const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function sanitiseLinks(value: unknown): RefLink[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is Doc => Boolean(item) && typeof item === 'object')
    .map((item, index) => ({ id: str(item.id, 60) || `link-${index}`, label: str(item.label, LIMITS.linkLabel), url: str(item.url, LIMITS.url) }))
    .filter((link) => isSafeHttpUrl(link.url))
    .slice(0, LIMITS.links);
}

export function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Accept anything that came from storage and return a well-formed Progress. Never throws. */
export function toProgress(key: string, doc: Doc | undefined): Progress {
  const base = emptyProgress(key);
  if (!doc) return base;
  return {
    key,
    title: str(doc.title, LIMITS.title) || undefined,
    url: typeof doc.url === 'string' && isSafeHttpUrl(doc.url) ? doc.url : undefined,
    completed: doc.completed === true,
    completedAt: num(doc.completedAt),
    completedNote: str(doc.completedNote, LIMITS.note),
    revised: doc.revised === true,
    revisedAt: num(doc.revisedAt),
    revisionCount: Math.max(0, Math.floor(num(doc.revisionCount) ?? 0)),
    revisedNote: str(doc.revisedNote, LIMITS.note),
    bookmarked: doc.bookmarked === true,
    mistake: str(doc.mistake, LIMITS.note),
    code: str(doc.code, LIMITS.code),
    // Before plain notes had their own field they lived in `code`; such notes still show in plain mode.
    // Changing the mode always writes `textNotes`, so this fallback only applies to untouched old notes.
    textNotes: typeof doc.textNotes === 'string' ? str(doc.textNotes, LIMITS.code) : doc.language === 'text' ? str(doc.code, LIMITS.code) : '',
    language: LANGUAGES.includes(doc.language as Language) ? (doc.language as Language) : base.language,
    links: sanitiseLinks(doc.links),
    clientUpdatedAt: num(doc.clientUpdatedAt) ?? 0,
  };
}

function toProblem(value: unknown): SheetProblem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Doc;
  const key = str(item.key, 200);
  const title = str(item.title, LIMITS.title);
  if (!key || !title) return null;
  const url = typeof item.url === 'string' && isSafeHttpUrl(item.url) ? item.url : null;
  const difficulty = ['Easy', 'Medium', 'Hard'].includes(item.difficulty as string) ? (item.difficulty as Difficulty) : undefined;
  return {
    key: safeDocId(key),
    title,
    url,
    ...(str(item.number, 10) ? { number: str(item.number, 10) } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(str(item.tier, 40) ? { tier: str(item.tier, 40) } : {}),
    group: str(item.group, 120) || 'Problems',
    ...(str(item.subgroup, 120) ? { subgroup: str(item.subgroup, 120) } : {}),
    ...(sanitiseLinks(item.defaultLinks)?.length ? { defaultLinks: sanitiseLinks(item.defaultLinks)! } : {}),
  };
}

export function toList(id: string, doc: Doc | undefined): DsaList | null {
  if (!doc) return null;
  const source = doc.source as DsaList['source'] | undefined;
  const validSource: DsaList['source'] =
    source?.kind === 'sheet' && typeof source.sheetId === 'string'
      ? { kind: 'sheet', sheetId: source.sheetId }
      : source?.kind === 'leetcode' && typeof source.url === 'string'
        ? { kind: 'leetcode', url: source.url }
        : { kind: 'custom' };
  const problems = Array.isArray(doc.problems) ? doc.problems.map(toProblem).filter(Boolean) as SheetProblem[] : [];
  const extraProblems = Array.isArray(doc.extraProblems) ? doc.extraProblems.map(toProblem).filter(Boolean) as SheetProblem[] : [];
  return {
    id,
    title: str(doc.title, LIMITS.title) || 'Untitled list',
    source: validSource,
    problems,
    extraProblems,
    hiddenKeys: Array.isArray(doc.hiddenKeys) ? doc.hiddenKeys.filter((key): key is string => typeof key === 'string') : [],
    archived: doc.archived === true,
    createdAt: num(doc.createdAt) ?? 0,
    updatedAt: num(doc.clientUpdatedAt) ?? num(doc.createdAt) ?? 0,
  };
}

/** The problems a list shows, in order: sheet/imported problems, then the person's own additions. */
export function listProblems(list: DsaList): SheetProblem[] {
  const fromSheet = list.source.kind === 'sheet' ? getSheet(list.source.sheetId)?.problems ?? [] : [];
  const hidden = new Set(list.hiddenKeys);
  const seen = new Set<string>();
  const out: SheetProblem[] = [];
  for (const problem of [...fromSheet, ...list.problems, ...list.extraProblems]) {
    if (hidden.has(problem.key) || seen.has(problem.key)) continue;
    seen.add(problem.key);
    out.push(problem);
  }
  return out;
}

export const effectiveLinks = (progress: Progress, problem: SheetProblem): RefLink[] => progress.links ?? problem.defaultLinks ?? [];

const DAY = 24 * 60 * 60 * 1000;

/** The shared study method: re-solve a problem cold about two days after first solving it. */
export function isDueForRevision(progress: Progress, now: number) {
  return progress.completed && !progress.revised && progress.completedAt !== null && now - progress.completedAt >= 2 * DAY;
}

export type Filter = 'all' | 'todo' | 'completed' | 'due' | 'revised' | 'bookmarked';

export function matchesFilter(progress: Progress, filter: Filter, now: number) {
  switch (filter) {
    case 'todo':
      return !progress.completed;
    case 'completed':
      return progress.completed;
    case 'due':
      return isDueForRevision(progress, now);
    case 'revised':
      return progress.revised;
    case 'bookmarked':
      return progress.bookmarked;
    default:
      return true;
  }
}

export type GroupMode = 'group' | 'difficulty';
export type ProblemGroup = { title: string; subgroups: Array<{ title: string | null; problems: SheetProblem[] }> };

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard', 'basic', 'core', 'pro', 'Premium', 'Not set'];
const difficultyLabel = (problem: SheetProblem) => problem.difficulty ?? problem.tier ?? 'Not set';

export function groupProblems(problems: SheetProblem[], mode: GroupMode): ProblemGroup[] {
  const groups = new Map<string, Map<string | null, SheetProblem[]>>();
  for (const problem of problems) {
    const top = mode === 'group' ? problem.group : difficultyLabel(problem);
    const sub = mode === 'group' ? problem.subgroup ?? null : problem.group;
    if (!groups.has(top)) groups.set(top, new Map());
    const subs = groups.get(top)!;
    if (!subs.has(sub)) subs.set(sub, []);
    subs.get(sub)!.push(problem);
  }
  const result = [...groups.entries()].map(([title, subs]) => ({
    title,
    subgroups: [...subs.entries()].map(([subtitle, items]) => ({ title: subtitle, problems: items })),
  }));
  if (mode === 'difficulty') {
    const rank = (title: string) => {
      const index = DIFFICULTY_ORDER.indexOf(title);
      return index === -1 ? DIFFICULTY_ORDER.length : index;
    };
    result.sort((a, b) => rank(a.title) - rank(b.title));
  }
  return result;
}

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
