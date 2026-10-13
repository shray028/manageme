import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, Check, ChevronDown, Plus, Search } from 'lucide-react';
import { getSheet } from '@/lib/dsa/sheets';
import { groupProblems, isDueForRevision, listProblems, matchesFilter, toProgress, type Filter, type GroupMode } from '@/lib/dsa/model';
import type { Doc } from '@/lib/dsa/sync';
import type { HistoryEntry } from '@/lib/dsa/remote';
import { TEXT_FIELDS, type DsaList, type Progress, type SheetProblem } from '@/lib/dsa/types';
import { ProblemDetail } from './problem-detail';
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
  ['due', 'Due'],
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
  selectedKey: string | null;
  darkEditor: boolean;
  onToggleDark: () => void;
  onSelect: (key: string | null) => void;
  onBack: () => void;
};

export function ListView({ list, store, selectedKey, darkEditor, onToggleDark, onSelect, onBack }: Props) {
  const [prefs, setPrefs] = useState(() => readPrefs(list.id));
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [historyFor, setHistoryFor] = useState<SheetProblem | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [now] = useState(() => Date.now());
  const sheet = list.source.kind === 'sheet' ? getSheet(list.source.sheetId) : undefined;
  const mainRef = useRef<HTMLDivElement>(null);

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
        progress.completedNote.toLowerCase().includes(needle) ||
        progress.revisedNote.toLowerCase().includes(needle) ||
        progress.textNotes.toLowerCase().includes(needle)
      );
    });
  }, [problems, progressMap, prefs.filter, query, now]);

  const groups = useMemo(() => groupProblems(visible, prefs.group), [visible, prefs.group]);
  /** Order of problems as they appear in the sidebar, for Previous/Next. */
  const ordered = useMemo(() => groups.flatMap((group) => group.subgroups.flatMap((sub) => sub.problems)), [groups]);
  const allGroupNames = useMemo(() => [...new Set(problems.map((problem) => problem.group))], [problems]);

  const selected = selectedKey ? problems.find((problem) => problem.key === selectedKey) : undefined;
  const navOrder = selected && !ordered.some((problem) => problem.key === selected.key) ? problems : ordered;
  const selectedIndex = selected ? navOrder.findIndex((problem) => problem.key === selected.key) : -1;

  // Keep the selected problem visible in the sidebar and start the centre at the top.
  useEffect(() => {
    if (!selectedKey) return;
    mainRef.current?.scrollTo({ top: 0 });
    document.querySelector(`[data-problem-key="${CSS.escape(selectedKey)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedKey]);

  const onChange = useCallback(
    (key: string, patch: Partial<Progress>, problem: SheetProblem) => {
      const existing = store.get('dsaProgress', key);
      const identity = !existing?.title ? { title: problem.title, url: problem.url ?? null } : {};
      store.update('dsaProgress', key, { ...identity, ...patch });
    },
    [store],
  );
  const onBlur = useCallback(() => void store.flush(), [store]);
  const onHide = useCallback(
    (problem: SheetProblem) => {
      const own = list.extraProblems.some((item) => item.key === problem.key);
      if (!window.confirm(`Remove “${problem.title}” from this list?\n\nYour notes and code for it are kept and come back if you add it again.`)) return;
      store.update(
        'dsaLists',
        list.id,
        own ? { extraProblems: list.extraProblems.filter((item) => item.key !== problem.key) } : { hiddenKeys: [...new Set([...list.hiddenKeys, problem.key])] },
      );
      onSelect(null);
    },
    [list, store, onSelect],
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

  const quickToggle = (problem: SheetProblem, field: 'completed' | 'revised') => {
    const progress = progressMap.get(problem.key)!;
    if (field === 'completed')
      onChange(problem.key, progress.completed ? { completed: false, completedAt: null } : { completed: true, completedAt: progress.completedAt ?? Date.now() }, problem);
    else
      onChange(
        problem.key,
        progress.revised
          ? { revised: false }
          : { revised: true, revisedAt: Date.now(), revisionCount: progress.revisionCount + 1, ...(progress.completed ? {} : { completed: true, completedAt: progress.completedAt ?? Date.now() }) },
        problem,
      );
  };

  const percent = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const nextTodo = problems.find((problem) => !progressMap.get(problem.key)!.completed);

  return (
    <div className="dsa-split">
      {/* ------------------------------------------------------------------ problem list */}
      <aside className={`dsa-sidebar ${selected ? 'dsa-mobile-hidden' : ''}`} aria-label="Problems">
        <div className="dsa-sidebar-head">
          <button type="button" className="dsa-text-btn inline-flex items-center gap-1 text-sm" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden /> Practice sheets
          </button>
          {renaming ? (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (title.trim()) store.update('dsaLists', list.id, { title: title.trim().slice(0, 300) });
                setRenaming(false);
              }}
            >
              <label htmlFor="list-title" className="sr-only">
                List name
              </label>
              <input id="list-title" className="dsa-input" value={title} onChange={(event) => setTitle(event.target.value)} />
              <button className="dsa-btn-primary" type="submit">
                Save
              </button>
            </form>
          ) : (
            <div className="mt-2 flex items-start justify-between gap-2">
              <h1 className="dsa-sidebar-title">{list.title}</h1>
              {!sheet && <button type="button" className="dsa-text-btn shrink-0 text-sm" onClick={() => setRenaming(true)}>Rename</button>}
            </div>
          )}

          <button type="button" className="dsa-progress-block" onClick={() => onSelect(null)} title="Show list overview">
            <span className="flex items-baseline justify-between gap-2">
              <span>
                <strong className="text-lg tabular-nums">{stats.done}</strong>
                <span className="text-[var(--dsa-muted)]"> / {stats.total} done</span>
              </span>
              <span className="text-sm tabular-nums text-[var(--dsa-muted)]">
                {stats.revised} revised · {stats.due} due
              </span>
            </span>
            <span
              className="dsa-progress mt-2 block"
              role="progressbar"
              aria-label="Problems done"
              aria-valuemin={0}
              aria-valuemax={stats.total}
              aria-valuenow={stats.done}
              aria-valuetext={`${stats.done} of ${stats.total} done`}
            >
              <span style={{ width: `${percent}%` }} />
            </span>
          </button>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--dsa-muted)]" aria-hidden />
            <label htmlFor="problem-search" className="sr-only">
              Search problems and notes
            </label>
            <input id="problem-search" type="search" className="dsa-input !py-2 !pl-9" placeholder="Search problems and notes" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>

          <div className="dsa-filters mt-3" role="group" aria-label="Show">
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

          <label className="mt-2 flex items-center justify-end gap-2 text-sm">
            <span className="text-[var(--dsa-muted)]">Group by</span>
            <select className="dsa-select !py-1" value={prefs.group} onChange={(event) => setPrefs((current) => ({ ...current, group: event.target.value as GroupMode }))}>
              <option value="group">{sheet?.groupLabel ?? 'Topic'}</option>
              <option value="difficulty">Difficulty</option>
            </select>
          </label>
        </div>

        <nav className="dsa-sidebar-list" aria-label="Problem list">
          {visible.length === 0 && (
            <p className="px-4 py-6 text-center text-[var(--dsa-muted)]">{problems.length ? 'Nothing matches this filter.' : 'No problems yet.'}</p>
          )}
          {groups.map((group) => {
            const items = group.subgroups.flatMap((sub) => sub.problems);
            const doneInGroup = items.filter((problem) => progressMap.get(problem.key)!.completed).length;
            const isCollapsed = collapsed.has(group.title);
            return (
              <section key={group.title}>
                <h2 className="m-0">
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
                    <ChevronDown className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-left">{group.title}</span>
                    <span className="dsa-count">
                      {doneInGroup}/{items.length}
                    </span>
                  </button>
                </h2>
                {!isCollapsed &&
                  group.subgroups.map((sub) => (
                    <div key={sub.title ?? '_'}>
                      {sub.title && <h3 className="dsa-subhead">{sub.title}</h3>}
                      <ul>
                        {sub.problems.map((problem) => {
                          const progress = progressMap.get(problem.key)!;
                          const active = problem.key === selectedKey;
                          return (
                            <li key={problem.key} className={`dsa-item ${active ? 'is-active' : ''}`} data-testid="problem-item" data-problem-key={problem.key}>
                              <button
                                type="button"
                                className={`dsa-mini-check ${progress.completed ? 'is-done' : ''}`}
                                role="checkbox"
                                aria-checked={progress.completed}
                                aria-label={`Done: ${problem.title}`}
                                onClick={() => quickToggle(problem, 'completed')}
                              >
                                {progress.completed && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                              </button>
                              <button type="button" className="dsa-item-main" aria-current={active ? 'true' : undefined} onClick={() => onSelect(problem.key)}>
                                <span className="dsa-item-title">
                                  {problem.number && <span className="tabular-nums text-[var(--dsa-muted)]">{problem.number}. </span>}
                                  <span>{problem.title}</span>
                                </span>
                                <span className="dsa-item-meta">
                                  {(problem.difficulty ?? problem.tier) && <span className={`dsa-dot dsa-dot-${(problem.difficulty ?? problem.tier ?? '').toLowerCase()}`}>{problem.difficulty ?? problem.tier}</span>}
                                  {isDueForRevision(progress, now) && <span className="text-[var(--dsa-revised)]">Due</span>}
                                  {progress.bookmarked && <Bookmark className="size-3.5 text-[var(--dsa-warn)]" fill="currentColor" aria-label="On weak list" />}
                                </span>
                              </button>
                              <button
                                type="button"
                                className={`dsa-revise-pill ${progress.revised ? 'is-on' : ''}`}
                                role="checkbox"
                                aria-checked={progress.revised}
                                aria-label={`Revised: ${problem.title}`}
                                onClick={() => quickToggle(problem, 'revised')}
                              >
                                {progress.revised ? (
                                  <>
                                    <Check className="size-3" strokeWidth={3} aria-hidden /> Revised
                                  </>
                                ) : (
                                  'Revise'
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
              </section>
            );
          })}
        </nav>

        <div className="dsa-sidebar-foot">
          <button type="button" className="dsa-btn-secondary w-full justify-center" onClick={() => onSelect(null)}>
            <Plus className="size-4" aria-hidden /> Add a problem
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ workspace */}
      <div ref={mainRef} className={`dsa-main ${selected ? '' : 'dsa-mobile-hidden'}`} id="dsa-workspace">
        {selected ? (
          <ProblemDetail
            key={selected.key}
            problem={selected}
            progress={progressMap.get(selected.key)!}
            position={{ index: Math.max(0, selectedIndex), total: navOrder.length }}
            now={now}
            darkEditor={darkEditor}
            onToggleDark={onToggleDark}
            onChange={onChange}
            onBlur={onBlur}
            onPrev={selectedIndex > 0 ? () => onSelect(navOrder[selectedIndex - 1].key) : undefined}
            onNext={selectedIndex >= 0 && selectedIndex < navOrder.length - 1 ? () => onSelect(navOrder[selectedIndex + 1].key) : undefined}
            onBack={() => onSelect(null)}
            onShowHistory={setHistoryFor}
            onHide={onHide}
          />
        ) : (
          <div className="dsa-detail">
            <h1 className="dsa-detail-title">{list.title}</h1>
            {sheet && (
              <p className="mt-1">
                <a className="dsa-link" href={sheet.sourceUrl} target="_blank" rel="noreferrer noopener">
                  View the original sheet
                </a>
              </p>
            )}
            {list.source.kind === 'leetcode' && (
              <p className="mt-1">
                <a className="dsa-link" href={list.source.url} target="_blank" rel="noreferrer noopener">
                  Imported from LeetCode
                </a>
              </p>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {[
                ['Done', stats.done],
                ['Revised', stats.revised],
                ['Due for revision', stats.due],
                ['Weak list', stats.weak],
              ].map(([label, value]) => (
                <div key={label as string} className="dsa-card">
                  <p className="text-3xl font-bold tabular-nums">{value}</p>
                  <p className="text-sm text-[var(--dsa-muted)]">{label}</p>
                </div>
              ))}
            </div>
            {nextTodo ? (
              <button type="button" className="dsa-btn-primary mt-6" onClick={() => onSelect(nextTodo.key)}>
                Continue with {nextTodo.number ? `${nextTodo.number}. ` : ''}
                {nextTodo.title}
              </button>
            ) : problems.length ? (
              <p className="mt-6 font-semibold">Every problem is done. Use “Due” to plan revisions.</p>
            ) : null}
            <p className="mt-3 text-[var(--dsa-muted)] max-lg:hidden">Or pick any problem on the left.</p>

            <div className="mt-10 space-y-4">
              <AddProblem
                groups={allGroupNames}
                existingKeys={new Set(problems.map((problem) => problem.key))}
                onAdd={(problem) => {
                  const hidden = list.hiddenKeys.filter((key) => key !== problem.key);
                  const inSheet = hidden.length !== list.hiddenKeys.length;
                  store.update('dsaLists', list.id, inSheet ? { hiddenKeys: hidden } : { extraProblems: [...list.extraProblems, problem] });
                }}
              />
              {list.hiddenKeys.length > 0 && (
                <div className="dsa-panel flex flex-wrap items-center justify-between gap-3">
                  <p>
                    {list.hiddenKeys.length} problem{list.hiddenKeys.length === 1 ? ' is' : 's are'} removed from this list. Their notes are kept.
                  </p>
                  <button type="button" className="dsa-btn-secondary" onClick={() => store.update('dsaLists', list.id, { hiddenKeys: [] })}>
                    Bring them back
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {historyFor && <HistoryDialog title={historyFor.title} load={loadHistory} onRestore={restore} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}
