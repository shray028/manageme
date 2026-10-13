export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type RefLink = {
  id: string;
  label: string;
  url: string;
};

/** A problem as it appears inside a sheet or list. */
export type SheetProblem = {
  /** Stable progress key. LeetCode slug when known, otherwise `src:slug`. */
  key: string;
  title: string;
  /** Where "Open problem" goes. */
  url: string | null;
  number?: string;
  difficulty?: Difficulty;
  /** Free-form tag from the source sheet (e.g. Striver's basic/core/pro). */
  tier?: string;
  /** Top-level group (data structure / pattern / chapter). */
  group: string;
  /** Optional second level (sub-pattern). */
  subgroup?: string;
  /** Links the sheet suggests by default (e.g. a video explanation). */
  defaultLinks?: RefLink[];
};

export type SheetDefinition = {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  /** How the sheet itself is organised, used as the default grouping. */
  groupLabel: string;
  subgroupLabel?: string;
  problems: SheetProblem[];
};

export type ListSource =
  | { kind: 'sheet'; sheetId: string }
  | { kind: 'leetcode'; url: string }
  | { kind: 'custom' };

/** A list stored in the user's account. */
export type DsaList = {
  id: string;
  title: string;
  source: ListSource;
  /** Problems copied in at import time (for leetcode/custom lists). Sheet lists read problems from the bundled sheet. */
  problems: SheetProblem[];
  /** Problems the user added to the list themselves. */
  extraProblems: SheetProblem[];
  /** Problem keys the user hid from this list. Progress for them is kept. */
  hiddenKeys: string[];
  archived: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Language = 'python' | 'java' | 'cpp' | 'javascript' | 'typescript' | 'go' | 'text';

/** Everything a person writes about one problem. Shared across every list containing it. */
export type Progress = {
  key: string;
  title?: string;
  url?: string | null;
  completed: boolean;
  completedAt: number | null;
  completedNote: string;
  revised: boolean;
  revisedAt: number | null;
  revisionCount: number;
  revisedNote: string;
  bookmarked: boolean;
  mistake: string;
  /** The code editor (any programming language). */
  code: string;
  /** Plain-text mode keeps its own notes, so switching modes never overwrites the code. */
  textNotes: string;
  language: Language;
  /** Links the person added or edited. `null` means "use the sheet's defaults". */
  links: RefLink[] | null;
  /** Client timestamp of the last local edit that produced this value. */
  clientUpdatedAt: number;
};

export type ProgressPatch = Partial<Omit<Progress, 'key'>>;

export const TEXT_FIELDS = ['completedNote', 'revisedNote', 'mistake', 'code', 'textNotes'] as const;

export const LIMITS = {
  code: 100_000,
  note: 20_000,
  linkLabel: 200,
  url: 2_000,
  links: 30,
  title: 300,
} as const;

export const emptyProgress = (key: string): Progress => ({
  key,
  completed: false,
  completedAt: null,
  completedNote: '',
  revised: false,
  revisedAt: null,
  revisionCount: 0,
  revisedNote: '',
  bookmarked: false,
  mistake: '',
  code: '',
  textNotes: '',
  language: 'python',
  links: null,
  clientUpdatedAt: 0,
});
