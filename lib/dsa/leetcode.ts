import type { Difficulty } from './types';

export type ParsedSource =
  | { kind: 'problem'; slug: string }
  | { kind: 'card'; slug: string }
  | { kind: 'studyplan'; slug: string }
  | { kind: 'unsupported-leetcode'; path: string }
  | { kind: 'other'; url: string };

const LEETCODE_HOSTS = new Set(['leetcode.com', 'www.leetcode.com', 'leetcode.cn', 'www.leetcode.cn']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normaliseUrl(raw: string): URL | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url;
  } catch {
    return null;
  }
}

export function parseSource(raw: string): ParsedSource | null {
  const url = normaliseUrl(raw);
  if (!url) return null;
  if (!LEETCODE_HOSTS.has(url.hostname.toLowerCase())) return { kind: 'other', url: url.toString() };
  const parts = url.pathname.split('/').filter(Boolean).map((part) => part.toLowerCase());
  // /problems/two-sum/ , /problems/two-sum/description/
  if (parts[0] === 'problems' && parts[1] && SLUG.test(parts[1])) return { kind: 'problem', slug: parts[1] };
  // /explore/interview/card/top-interview-questions-easy/ , /explore/learn/card/<slug>/
  const cardIndex = parts.indexOf('card');
  if (parts[0] === 'explore' && cardIndex > 0 && parts[cardIndex + 1] && SLUG.test(parts[cardIndex + 1]))
    return { kind: 'card', slug: parts[cardIndex + 1] };
  // /studyplan/top-interview-150/
  if (parts[0] === 'studyplan' && parts[1] && SLUG.test(parts[1])) return { kind: 'studyplan', slug: parts[1] };
  return { kind: 'unsupported-leetcode', path: url.pathname };
}

/** Every LeetCode problem link inside a block of pasted text, in order, without duplicates. */
export function extractProblemSlugs(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const pattern = /leetcode\.(?:com|cn)\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)/gi;
  for (const match of text.matchAll(pattern)) {
    const slug = match[1].toLowerCase();
    if (!seen.has(slug)) {
      seen.add(slug);
      result.push(slug);
    }
  }
  return result;
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

/** Readable title from a slug, used when the LeetCode lookup is unavailable. */
export function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word, index) => {
      if (/^(ii|iii|iv|v|vi|bst|lru|lfu|xor|k)$/.test(word)) return word.toUpperCase();
      if (index > 0 && SMALL_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export const problemUrl = (slug: string) => `https://leetcode.com/problems/${slug}/`;

export function normaliseDifficulty(value: unknown): Difficulty | undefined {
  if (typeof value !== 'string') return undefined;
  const lower = value.toLowerCase();
  if (lower === 'easy') return 'Easy';
  if (lower === 'medium') return 'Medium';
  if (lower === 'hard') return 'Hard';
  return undefined;
}

/** Firestore document IDs cannot contain "/" and must not be "." or "..". Keep keys readable but safe. */
export function safeDocId(key: string): string {
  const cleaned = key
    .normalize('NFKC')
    .replace(/[/\\#?\s]+/g, '-')
    .replace(/[^\w:'().+-]/g, '')
    .replace(/^\.+$/, '')
    .slice(0, 200);
  return cleaned || 'problem';
}

export const leetcodeKey = (slug: string) => safeDocId(slug.toLowerCase());
