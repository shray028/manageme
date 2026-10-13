import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Search } from 'lucide-react';
import { getSheet } from '@/lib/dsa/sheets';
import { groupProblems, listProblems, matchesFilter, toProgress, type Filter, type GroupMode, isDueForRevision } from '@/lib/dsa/model';
import type { Doc } from '@/lib/dsa/sync';
import type { HistoryEntry } from '@/lib/dsa/remote';
import { TEXT_FIELDS, type DsaList, type Progress, type SheetProblem } from '@/lib/dsa/types';
import { ProblemRow } from './problem-row';
import { AddProblem } from './add-problem';
import { HistoryDialog } from './history-dialog';
import type { DsaStore } from './use-dsa';

const progressCache = new WeakMap<Doc, Progress>();
const emptyCache = new Map<string, Progress>();
function progressFor(key: string, doc: Doc | undefined): Progress {
  if (!doc) {
    if (!emptyCache.has(key)) emptyCache.set(key, toProgress(key, undefined));
    return emptyCache.get(key)!;
  }
  let cached = progressCache.get(doc);
  if (!cached) {
    cached = toProgress(key, doc);
    progressCache.set(doc, cached);
  }
  return cached;
}

const FILTERS: Array<[Filter, string]> = [
  ['all', 'All'],
  ['todo', 'To do'],
  ['completed', 'Done'],
  ['due', 'Due for revision'],
  ['revised', 'Revised'],
  ['bookmarked', 'Weak list'],
];

const prefKey = (listId: string) => `manageme:dsa:view:${listId}`;
function readPrefs(listId: string): { filter: Filter; group: GroupMode } {
  try {
    const value = JSON.parse(localStorage.getItem(prefKey(listId)) || '{}');
    return { filter: FILTERS.some(([f]) => f === value.filter) ? value.filter : 'all', group: value.group === 'difficulty' ? 'difficulty' : 'group' };
  } catch {
    return { filter: 'all', group: 'group' };
  }
}

type Props = {
  list: DsaList;
  store: DsaStore;
  darkEditor: boolean;
  onBack: () => void;
};

export function ListView({ list, store, darkEditor, onBack }: Props) {
  const [prefs, setPrefs] = useState(() => readPrefs(list.id));
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [historyFor, setHistoryFor] = useState<SheetProblem | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [now] = useState(() => Date.now());
  const sheet = list.source.kind === 'sheet' ? getSheet(list.source.sheetId) : undefined;

  useEffect(() => {
    try {
      localStorage.setItem(prefKey(list.id), JSON.stringify(prefs));
    } catch {
      /* preferences are optional */
    }
  }, [list.id, prefs]);

  const problems = useMemo(() => listProblems(list), [list]);
  const progressMap = useMemo(() => {
    const map = new Map<string, Progress>();
    for (const problem of problems) map.set(problem.key, progressFor(problem.key, store.get('dsaProgress', problem.key)));
    return map;
    // store.version changes whenever any document changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems, store.version]);

  const stats = useMemo(() => {
    let done = 0;
    let revised = 0;
    let due = 0;
    let weak = 0;
    for (const problem of problems) {
      const progress = progressMap.get(problem.key)!;
      if (progress.completed) done += 1;
      if (progress.revised) revised += 1;
      if (isDueForRevision(progress, now)) due += 1;
      if (progress.bookmarked) weak += 1;
    }
    return { done, revised, due, weak, total: problems.length };
  }, [problems, progressMap, now]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return problems.filter((problem) => {
      const progress = progressMap.get(problem.key)!;
      if (!matchesFilter(progress, prefs.filter, now)) return false;
      if (!needle) return true;
      return (
        problem.title.toLowerCase().includes(needle) ||
        problem.number === needle ||
        problem.group.toLowerCase().includes(needle) ||
        (problem.subgroup ?? '').toLowerCase().includes(needle) ||
        progress.mistake.toLowerCase().includes(needle) ||
        progress.completedNote.toLowerCase().includes(needle)
      );
    });
  }, [problems, progressMap, prefs.filter, query, now]);

  const groups = useMemo(() => groupProblems(visible, prefs.group), [visible, prefs.group]);
  const allGroupNames = useMemo(() => [...new Set(problems.map((problem) => problem.group))], [problems]);

  const onChange = useCallback(
    (key: string, patch: Partial<Progress>, problem: SheetProblem) => {
      const existing = store.get('dsaProgress', key);
      // Store the title/link with the progress so backups and other lists stay readable.
      const identity = !existing?.title ? { title: problem.title, url: problem.url ?? null } : {};
      store.update('dsaProgress', key, { ...identity, ...patch });
    },
    [store],
  );
  const onToggleOpen = useCallback((key: string) => setOpenKey((current) => (current === key ? null : key)), []);
  const onBlur = useCallback(() => void store.flush(), [store]);
  const onShowHistory = useCallback((problem: SheetProblem) => setHistoryFor(problem), []);
  const onHide = useCallback(
    (problem: SheetProblem) => {
      const own = list.extraProblems.some((item) => item.key === problem.key);
      if (!window.confirm(`Remove “${problem.title}” from this list?\n\nYour notes and code for it are kept and come back if you add it again.`)) return;
      store.update(
        'dsaLists',
        list.id,
        own ? { extraProblems: list.extraProblems.filter((item) => item.key !== problem.key) } : { hiddenKeys: [...new Set([...list.hiddenKeys, problem.key])] },
      );
      setOpenKey(null);
    },
    [list, store],
  );

  const loadHistory = useCallback(() => (store.remote && historyFor ? store.remote.listHistory('dsaProgress', historyFor.key) : Promise.resolve([] as HistoryEntry[])), [store.remote, historyFor]);

  const restore = (entry: HistoryEntry) => {
    if (!historyFor || !store.remote) return;
    const current = progressFor(historyFor.key, store.get('dsaProgress', historyFor.key));
    const before: Doc = { savedAt: Date.now(), reason: 'before-restore', links: current.links };
    for (const field of TEXT_FIELDS) before[field] = current[field];
    void store.remote.writeHistory('dsaProgress', historyFor.key, before).catch(() => undefined);
    const patch: Doc = {};
    for (const field of TEXT_FIELDS) if (typeof entry.data[field] === 'string') patch[field] = entry.data[field];
    if ('links' in entry.data) patch.links = entry.data.links ?? null;
    store.update('dsaProgress', historyFor.key, patch);
  };

  const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const hiddenCount = list.hiddenKeys.length;

  return (
    <div>
      <button type="button" className="dsa-text-btn mb-4 inline-flex items-center gap-1.5" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden /> All lists
      </button>

      <header className="mb-6">
        {renaming ? (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (title.trim()) store.update('dsaLists', list.id, { title: title.trim().slice(0, 300) });
              setRenaming(false);
            }}
          >
            <label htmlFor="list-title" className="sr-only">
              List name
            </label>
            <input id="list-title" className="dsa-input max-w-xl text-xl" value={title} onChange={(event) => setTitle(event.target.value)} />
            <button className="dsa-btn-primary" type="submit">
              Save name
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="dsa-h1">{list.title}</h1>
            <button type="button" className="dsa-text-btn" onClick={() => setRenaming(true)}>
              Rename
            </button>
          </div>
        )}
        {sheet && (
          <p className="mt-1 text-[var(--dsa-muted)]">
            <a className="dsa-link" href={sheet.sourceUrl} target="_blank" rel="noreferrer noopener">
              View the original sheet
            </a>
          </p>
        )}
        {list.source.kind === 'leetcode' && (
          <p className="mt-1 text-[var(--dsa-muted)]">
            Imported from{' '}
            <a className="dsa-link" href={list.source.url} target="_blank" rel="noreferrer noopener">
              LeetCode
            </a>
          </p>
        )}

        <div className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-lg">
              <strong className="text-2xl">{stats.done}</strong> of {stats.total} done
            </p>
            <p className="text-[var(--dsa-muted)]">
              {stats.revised} revised · {stats.due} due for revision · {stats.weak} on weak list
            </p>
          </div>
          <div
            className="dsa-progress mt-2"
            role="progressbar"
            aria-label="Problems done"
            aria-valuemin={0}
            aria-valuemax={stats.total}
            aria-valuenow={stats.done}
            aria-valuetext={`${stats.done} of ${stats.total} done`}
          >
            <div style={{ width: `${percent}%` }} />
          </div>
        </div>
      </header>

      <div className="dsa-toolbar">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--dsa-muted)]" aria-hidden />
          <label htmlFor="problem-search" className="sr-only">
            Search problems and notes
          </label>
          <input id="problem-search" type="search" className="dsa-input !pl-9" placeholder="Search problems and notes" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <label className="flex items-center gap-2">
          <span>Group by</span>
          <select className="dsa-input !w-auto" value={prefs.group} onChange={(event) => setPrefs((current) => ({ ...current, group: event.target.value as GroupMode }))}>
            <option value="group">{sheet?.groupLabel ?? 'Topic'}</option>
            <option value="difficulty">Difficulty</option>
          </select>
        </label>
      </div>

      <div className="mb-5 mt-3 flex flex-wrap gap-2" role="group" aria-label="Show">
        {FILTERS.map(([value, label]) => {
          const count = value === 'due' ? stats.due : value === 'bookmarked' ? stats.weak : null;
          return (
            <button
              key={value}
              type="button"
              className={`dsa-chip ${prefs.filter === value ? 'is-on' : ''}`}
              aria-pressed={prefs.filter === value}
              onClick={() => setPrefs((current) => ({ ...current, filter: value }))}
            >
              {label}
              {count ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {prefs.filter === 'due' && (
        <p className="dsa-note mb-4">These are problems you marked done at least two days ago and haven’t revised. Re-solve each one without looking at your notes first.</p>
      )}

      {visible.length === 0 && (
        <div className="dsa-panel mb-6 text-center">
          <p className="font-semibold">{problems.length ? 'Nothing matches.' : 'This list is empty.'}</p>
          <p className="text-[var(--dsa-muted)]">{problems.length ? 'Try another filter or clear the search.' : 'Add your first problem below.'}</p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((group) => {
          const items = group.subgroups.flatMap((sub) => sub.problems);
          const doneInGroup = items.filter((problem) => progressMap.get(problem.key)!.completed).length;
          const isCollapsed = collapsed.has(group.title);
          const headingId = `group-${group.title.replace(/[^a-z0-9]+/gi, '-')}`;
          return (
            <section key={group.title} aria-labelledby={headingId}>
              <h2 id={headingId} className="m-0">
                <button
                  type="button"
                  className="dsa-group-head"
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(group.title)) next.delete(group.title);
                      else next.add(group.title);
                      return next;
                    })
                  }
                >
                  <ChevronDown className={`size-5 transition-transform motion-reduce:transition-none ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden />
                  <span className="flex-1 text-left">{group.title}</span>
                  <span className="text-base font-normal text-[var(--dsa-muted)]">
                    {doneInGroup}/{items.length} done
                  </span>
                </button>
              </h2>
              {!isCollapsed &&
                group.subgroups.map((sub) => (
                  <div key={sub.title ?? '_'} className="mt-2">
                    {sub.title && <h3 className="dsa-subhead">{sub.title}</h3>}
                    <ul className="dsa-rows">
                      {sub.problems.map((problem) => (
                        <ProblemRow
                          key={problem.key}
                          problem={problem}
                          progress={progressMap.get(problem.key)!}
                          open={openKey === problem.key}
                          now={now}
                          darkEditor={darkEditor}
                          onToggleOpen={onToggleOpen}
                          onChange={onChange}
                          onBlur={onBlur}
                          onShowHistory={onShowHistory}
                          onHide={onHide}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
            </section>
          );
        })}
      </div>

      <div className="mt-8 space-y-4">
        <AddProblem
          groups={allGroupNames}
          existingKeys={new Set(problems.map((problem) => problem.key))}
          onAdd={(problem) => {
            const hidden = list.hiddenKeys.filter((key) => key !== problem.key);
            const inSheet = hidden.length !== list.hiddenKeys.length;
            store.update('dsaLists', list.id, inSheet ? { hiddenKeys: hidden } : { extraProblems: [...list.extraProblems, problem] });
          }}
        />
        {hiddenCount > 0 && (
          <div className="dsa-panel flex flex-wrap items-center justify-between gap-3">
            <p>
              {hiddenCount} problem{hiddenCount === 1 ? ' is' : 's are'} removed from this list. Their notes are kept.
            </p>
            <button type="button" className="dsa-btn-secondary" onClick={() => store.update('dsaLists', list.id, { hiddenKeys: [] })}>
              Bring them back
            </button>
          </div>
        )}
      </div>

      {historyFor && <HistoryDialog title={historyFor.title} load={loadHistory} onRestore={restore} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}
