import type { Difficulty, SheetDefinition, SheetProblem } from '../types';
import { leetcodeKey, problemUrl, safeDocId } from '../leetcode';
import striverRows from './strivers-180.json';
import topInterviewMH from './leetcode-top-interview-mh.json';

type StriverRow = [group: string, subgroup: string, title: string, leetcode: string | null, video: string | null, tufSlug: string, tier: string];

function buildStriver(): SheetDefinition {
  const usedKeys = new Set<string>();
  const problems: SheetProblem[] = (striverRows as StriverRow[]).map(([group, subgroup, title, leetcode, video, tufSlug, tier]) => {
    const isPlainSlug = Boolean(leetcode && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(leetcode));
    // Two sheet entries can point at the same LeetCode problem (e.g. both cycle-detection variants
    // use Course Schedule). They are separate items in the sheet, so only the first one shares
    // progress with the LeetCode problem; later ones get their own key.
    let key = isPlainSlug ? leetcodeKey(leetcode!) : safeDocId(`tuf:${tufSlug}`);
    if (usedKeys.has(key)) key = safeDocId(`tuf:${tufSlug}`);
    usedKeys.add(key);
    const url = leetcode
      ? `https://leetcode.com/problems/${leetcode.replace(/\/$/, '')}/`
      : `https://takeuforward.org/practice/dsa/${encodeURIComponent(tufSlug)}`;
    return {
      key,
      title: title.trim(),
      url,
      tier,
      group,
      subgroup,
      defaultLinks: video ? [{ id: 'striver-video', label: "Striver's video explanation", url: video }] : [],
    };
  });
  return {
    id: 'strivers-180',
    title: "Striver's 180 – Master DSA Patterns",
    description: '179 problems organised by pattern, each with Striver’s video where available.',
    sourceUrl: 'https://takeuforward.org/prep-hub/strivers-180-master-dsa-patterns',
    groupLabel: 'Pattern',
    subgroupLabel: 'Sub-pattern',
    problems,
  };
}

type EasyRow = [number: string, slug: string, title: string, difficulty: 'E' | 'M' | 'H'];
const easyChapters: Array<[string, EasyRow[]]> = [
  ['Array', [
    ['26', 'remove-duplicates-from-sorted-array', 'Remove Duplicates from Sorted Array', 'E'],
    ['122', 'best-time-to-buy-and-sell-stock-ii', 'Best Time to Buy and Sell Stock II', 'M'],
    ['189', 'rotate-array', 'Rotate Array', 'M'],
    ['217', 'contains-duplicate', 'Contains Duplicate', 'E'],
    ['136', 'single-number', 'Single Number', 'E'],
    ['350', 'intersection-of-two-arrays-ii', 'Intersection of Two Arrays II', 'E'],
    ['66', 'plus-one', 'Plus One', 'E'],
    ['283', 'move-zeroes', 'Move Zeroes', 'E'],
    ['1', 'two-sum', 'Two Sum', 'E'],
    ['36', 'valid-sudoku', 'Valid Sudoku', 'M'],
    ['48', 'rotate-image', 'Rotate Image', 'M'],
  ]],
  ['Strings', [
    ['344', 'reverse-string', 'Reverse String', 'E'],
    ['7', 'reverse-integer', 'Reverse Integer', 'M'],
    ['387', 'first-unique-character-in-a-string', 'First Unique Character in a String', 'E'],
    ['242', 'valid-anagram', 'Valid Anagram', 'E'],
    ['125', 'valid-palindrome', 'Valid Palindrome', 'E'],
    ['8', 'string-to-integer-atoi', 'String to Integer (atoi)', 'M'],
    ['28', 'find-the-index-of-the-first-occurrence-in-a-string', 'Find the Index of the First Occurrence in a String', 'E'],
    ['14', 'longest-common-prefix', 'Longest Common Prefix', 'E'],
  ]],
  ['Linked List', [
    ['237', 'delete-node-in-a-linked-list', 'Delete Node in a Linked List', 'M'],
    ['19', 'remove-nth-node-from-end-of-list', 'Remove Nth Node From End of List', 'M'],
    ['206', 'reverse-linked-list', 'Reverse Linked List', 'E'],
    ['21', 'merge-two-sorted-lists', 'Merge Two Sorted Lists', 'E'],
    ['234', 'palindrome-linked-list', 'Palindrome Linked List', 'E'],
    ['141', 'linked-list-cycle', 'Linked List Cycle', 'E'],
  ]],
  ['Trees', [
    ['104', 'maximum-depth-of-binary-tree', 'Maximum Depth of Binary Tree', 'E'],
    ['98', 'validate-binary-search-tree', 'Validate Binary Search Tree', 'M'],
    ['101', 'symmetric-tree', 'Symmetric Tree', 'E'],
    ['102', 'binary-tree-level-order-traversal', 'Binary Tree Level Order Traversal', 'M'],
    ['108', 'convert-sorted-array-to-binary-search-tree', 'Convert Sorted Array to Binary Search Tree', 'E'],
  ]],
  ['Sorting and Searching', [
    ['88', 'merge-sorted-array', 'Merge Sorted Array', 'E'],
    ['278', 'first-bad-version', 'First Bad Version', 'E'],
  ]],
  ['Dynamic Programming', [
    ['70', 'climbing-stairs', 'Climbing Stairs', 'E'],
    ['121', 'best-time-to-buy-and-sell-stock', 'Best Time to Buy and Sell Stock', 'E'],
    ['53', 'maximum-subarray', 'Maximum Subarray', 'M'],
    ['198', 'house-robber', 'House Robber', 'M'],
  ]],
  ['Design', [
    ['384', 'shuffle-an-array', 'Shuffle an Array', 'M'],
    ['155', 'min-stack', 'Min Stack', 'M'],
  ]],
  ['Math', [
    ['412', 'fizz-buzz', 'Fizz Buzz', 'E'],
    ['204', 'count-primes', 'Count Primes', 'M'],
    ['326', 'power-of-three', 'Power of Three', 'E'],
    ['13', 'roman-to-integer', 'Roman to Integer', 'E'],
  ]],
  ['Others', [
    ['191', 'number-of-1-bits', 'Number of 1 Bits', 'E'],
    ['461', 'hamming-distance', 'Hamming Distance', 'E'],
    ['190', 'reverse-bits', 'Reverse Bits', 'E'],
    ['118', 'pascals-triangle', "Pascal's Triangle", 'E'],
    ['20', 'valid-parentheses', 'Valid Parentheses', 'E'],
    ['268', 'missing-number', 'Missing Number', 'E'],
  ]],
];

const difficultyFromLetter: Record<'E' | 'M' | 'H', Difficulty> = { E: 'Easy', M: 'Medium', H: 'Hard' };

function buildTopInterviewEasy(): SheetDefinition {
  return {
    id: 'leetcode-top-interview-easy',
    title: 'LeetCode Top Interview Questions (Easy collection)',
    description: '48 classic interview problems grouped by data structure, with LeetCode difficulty.',
    sourceUrl: 'https://leetcode.com/explore/interview/card/top-interview-questions-easy/',
    groupLabel: 'Data structure',
    problems: easyChapters.flatMap(([group, rows]) =>
      rows.map(([number, slug, title, letter]) => ({
        key: leetcodeKey(slug),
        title,
        url: problemUrl(slug),
        number,
        difficulty: difficultyFromLetter[letter],
        group,
      })),
    ),
  };
}

type MhRow = [number: string, slugOrTitle: string, title: string | null, difficulty: string, paid: number | null];

/** Turn "Meeting Rooms II" into "meeting-rooms-ii" for premium items LeetCode does not expose. */
export const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[()']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function buildFromCard(id: string, title: string, description: string, cardSlug: string, chapters: Array<[string, MhRow[]]>): SheetDefinition {
  return {
    id,
    title,
    description,
    sourceUrl: `https://leetcode.com/explore/interview/card/${cardSlug}/`,
    groupLabel: 'Data structure',
    problems: chapters.flatMap(([group, rows]) =>
      rows.map(([number, slugOrTitle, rowTitle, letter]) => {
        if (number === '?') {
          // Premium problem: LeetCode only reveals the title to subscribers.
          const slug = slugify(slugOrTitle);
          return { key: leetcodeKey(slug), title: slugOrTitle, url: problemUrl(slug), group, tier: 'Premium' };
        }
        return {
          key: leetcodeKey(slugOrTitle),
          title: rowTitle ?? slugOrTitle,
          url: problemUrl(slugOrTitle),
          number,
          difficulty: difficultyFromLetter[letter as 'E' | 'M' | 'H'],
          group,
        };
      }),
    ),
  };
}

const mh = topInterviewMH as unknown as { m: [string, Array<[string, MhRow[]]>]; h: [string, Array<[string, MhRow[]]>] };

export const SHEETS: SheetDefinition[] = [buildTopInterviewEasy(), buildStriver()];

/** Lists we ship a copy of, so importing them works even when LeetCode can't be reached. */
export const EXTRA_BUNDLED: SheetDefinition[] = [
  buildFromCard('leetcode-top-interview-medium', 'LeetCode Top Interview Questions (Medium collection)', 'The medium follow-up to the easy collection, grouped by data structure.', 'top-interview-questions-medium', mh.m[1]),
  buildFromCard('leetcode-top-interview-hard', 'LeetCode Top Interview Questions (Hard collection)', 'The hard follow-up collection, grouped by data structure.', 'top-interview-questions-hard', mh.h[1]),
];

export const getSheet = (id: string) => [...SHEETS, ...EXTRA_BUNDLED].find((sheet) => sheet.id === id);

/** Bundled copies of LeetCode sources, used when the live LeetCode lookup is unavailable. */
export const BUNDLED_LEETCODE_SOURCES: Record<string, string> = {
  'card:top-interview-questions-easy': 'leetcode-top-interview-easy',
  'card:top-interview-questions-medium': 'leetcode-top-interview-medium',
  'card:top-interview-questions-hard': 'leetcode-top-interview-hard',
};
