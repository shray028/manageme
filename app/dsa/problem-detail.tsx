import { lazy, Suspense, useId, useState } from 'react';
import { Bookmark, Check, ChevronLeft, ChevronRight, ExternalLink, History, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { effectiveLinks, isDueForRevision, isSafeHttpUrl, newId } from '@/lib/dsa/model';
import { LIMITS, type Language, type Progress, type RefLink, type SheetProblem } from '@/lib/dsa/types';

const CodeEditor = lazy(() => import('./code-editor'));

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  go: 'Go',
  text: 'Plain notes',
};

export const difficultyClass = (problem: SheetProblem) => {
  const label = problem.difficulty ?? problem.tier;
  if (label === 'Easy' || label === 'basic') return 'dsa-tag-easy';
  if (label === 'Medium' || label === 'core') return 'dsa-tag-medium';
  if (label === 'Hard' || label === 'pro') return 'dsa-tag-hard';
  return 'dsa-tag-neutral';
};

const formatDate = (millis: number | null) =>
  millis ? new Date(millis).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

type Props = {
  problem: SheetProblem;
  progress: Progress;
  position: { index: number; total: number };
  now: number;
  darkEditor: boolean;
  onToggleDark: () => void;
  onChange: (key: string, patch: Partial<Progress>, problem: SheetProblem) => void;
  onBlur: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onBack: () => void;
  onShowHistory: (problem: SheetProblem) => void;
  onHide: (problem: SheetProblem) => void;
};

/** The centre workspace for one problem. */
export function ProblemDetail({ problem, progress, position, now, darkEditor, onToggleDark, onChange, onBlur, onPrev, onNext, onBack, onShowHistory, onHide }: Props) {
  const change = (patch: Partial<Progress>) => onChange(problem.key, patch, problem);
  const label = problem.difficulty ?? problem.tier;
  const due = isDueForRevision(progress, now);
  const tooLong = progress.code.length >= LIMITS.code;
  const editorLabelId = useId();

  return (
    <article className="dsa-detail" data-testid="problem-detail" aria-labelledby="problem-title">
      <div className="dsa-detail-nav">
        <button type="button" className="dsa-text-btn inline-flex items-center gap-1 lg:hidden" onClick={onBack}>
          <ChevronLeft className="size-4" aria-hidden /> All problems
        </button>
        <p className="hidden truncate text-sm text-[var(--dsa-muted)] lg:block">
          {problem.group}
          {problem.subgroup ? ` / ${problem.subgroup}` : ''}
        </p>
        <div className="flex items-center gap-1">
          <span className="mr-2 text-sm tabular-nums text-[var(--dsa-muted)]">
            {position.index + 1} of {position.total}
          </span>
          <button type="button" className="dsa-icon-btn" onClick={onPrev} disabled={!onPrev} aria-label="Previous problem" title="Previous problem">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" className="dsa-icon-btn" onClick={onNext} disabled={!onNext} aria-label="Next problem" title="Next problem">
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      <header className="mt-2">
        <h1 id="problem-title" className="dsa-detail-title">
          {problem.number && <span className="text-[var(--dsa-muted)]">{problem.number}. </span>}
          {problem.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {label && <span className={`dsa-tag ${difficultyClass(problem)}`}>{label}</span>}
          {due && <span className="dsa-tag dsa-tag-due">Due for revision</span>}
          {progress.completed && progress.completedAt && <span className="text-sm text-[var(--dsa-muted)]">Done {formatDate(progress.completedAt)}</span>}
          {progress.revised && progress.revisedAt && (
            <span className="text-sm text-[var(--dsa-muted)]">
              · Revised {formatDate(progress.revisedAt)}
              {progress.revisionCount > 1 ? ` (${progress.revisionCount}×)` : ''}
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={progress.completed}
            className={`dsa-toggle ${progress.completed ? 'is-done' : ''}`}
            onClick={() => change(progress.completed ? { completed: false, completedAt: null } : { completed: true, completedAt: progress.completedAt ?? Date.now() })}
          >
            <span className="dsa-toggle-box" aria-hidden>
              {progress.completed && <Check className="size-4" strokeWidth={3} />}
            </span>
            Done
          </button>
          <button
            type="button"
            role="checkbox"
            aria-checked={progress.revised}
            className={`dsa-toggle ${progress.revised ? 'is-revised' : ''}`}
            onClick={() =>
              change(
                progress.revised
                  ? { revised: false }
                  : { revised: true, revisedAt: Date.now(), revisionCount: progress.revisionCount + 1, ...(progress.completed ? {} : { completed: true, completedAt: progress.completedAt ?? Date.now() }) },
              )
            }
          >
            <span className="dsa-toggle-box" aria-hidden>
              {progress.revised && <Check className="size-4" strokeWidth={3} />}
            </span>
            Revised
          </button>
          {progress.revised && (
            <button type="button" className="dsa-btn-ghost" onClick={() => change({ revisedAt: Date.now(), revisionCount: progress.revisionCount + 1 })}>
              <RotateCcw className="size-4" aria-hidden /> Revised again today
            </button>
          )}
          <button
            type="button"
            className={`dsa-toggle ${progress.bookmarked ? 'is-weak' : ''}`}
            aria-pressed={progress.bookmarked}
            onClick={() => change({ bookmarked: !progress.bookmarked })}
          >
            <Bookmark className="size-4" fill={progress.bookmarked ? 'currentColor' : 'none'} aria-hidden />
            {progress.bookmarked ? 'On weak list' : 'Add to weak list'}
          </button>
          <span className="flex-1" />
          {problem.url && (
            <a className="dsa-btn-primary" href={problem.url} target="_blank" rel="noreferrer noopener">
              Open problem <ExternalLink className="size-4" aria-hidden />
            </a>
          )}
        </div>
      </header>

      <section aria-labelledby={editorLabelId} className="mt-6">
        <div className="dsa-editor-bar">
          <h2 id={editorLabelId} className="dsa-section-title">
            Code &amp; notes
          </h2>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`${editorLabelId}-lang`}>
              Language
            </label>
            <select id={`${editorLabelId}-lang`} className="dsa-select" value={progress.language} onChange={(event) => change({ language: event.target.value as Language })}>
              {Object.entries(LANGUAGE_LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            <button type="button" className="dsa-btn-ghost !min-h-9 !px-2.5 !py-1.5 text-sm" onClick={onToggleDark} aria-pressed={darkEditor}>
              {darkEditor ? 'Light editor' : 'Dark editor'}
            </button>
          </div>
        </div>
        <Suspense fallback={<div className="dsa-editor-loading">Loading editor…</div>}>
          <CodeEditor
            value={progress.code}
            language={progress.language}
            dark={darkEditor}
            label={`Code and notes for ${problem.title}`}
            onChange={(code) => change({ code: code.slice(0, LIMITS.code) })}
            onBlur={onBlur}
          />
        </Suspense>
        <p className="mt-2 text-sm text-[var(--dsa-muted)]">Tab indents. Press Esc, then Tab, to leave the editor.</p>
        {tooLong && <p className="mt-1 text-sm font-semibold text-[var(--dsa-danger)]">This box is full ({LIMITS.code.toLocaleString()} characters). Anything longer won’t be saved.</p>}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <NoteField
          label="When I solved it"
          hint="Approach, complexity, the pattern it uses"
          value={progress.completedNote}
          onChange={(value) => change({ completedNote: value })}
          onBlur={onBlur}
          placeholder="This is a … problem because …"
        />
        <NoteField
          label="When I revised it"
          hint="Re-solved it cold? What you remembered and what you forgot"
          value={progress.revisedNote}
          onChange={(value) => change({ revisedNote: value })}
          onBlur={onBlur}
          placeholder="What tripped me up this time…"
        />
        <NoteField
          label="Mistake to remember"
          hint="Shows on your weak list"
          value={progress.mistake}
          onChange={(value) => change({ mistake: value })}
          onBlur={onBlur}
          placeholder="e.g. Forgot the empty-array case"
        />
        <LinksEditor problem={problem} progress={progress} change={change} />
      </div>

      <footer className="mt-8 flex flex-wrap gap-2 border-t border-[var(--dsa-line)] pt-5">
        <button type="button" className="dsa-btn-ghost" onClick={() => onShowHistory(problem)}>
          <History className="size-4" aria-hidden /> Earlier versions
        </button>
        <button type="button" className="dsa-btn-ghost" onClick={() => onHide(problem)}>
          <Trash2 className="size-4" aria-hidden /> Remove from this list
        </button>
      </footer>
    </article>
  );
}

function NoteField({
  label,
  hint,
  value,
  placeholder,
  onChange,
  onBlur,
}: {
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const id = useId();
  return (
    <div className="dsa-card">
      <label htmlFor={id} className="dsa-section-title block">
        {label}
      </label>
      <p id={`${id}-hint`} className="mb-2 text-sm text-[var(--dsa-muted)]">
        {hint}
      </p>
      <textarea
        id={id}
        aria-describedby={`${id}-hint`}
        className="dsa-input min-h-[120px] resize-y"
        value={value}
        maxLength={LIMITS.note}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}

function LinksEditor({ problem, progress, change }: { problem: SheetProblem; progress: Progress; change: (patch: Partial<Progress>) => void }) {
  const links = effectiveLinks(progress, problem);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const labelId = useId();

  const save = (next: RefLink[]) => change({ links: next });
  const add = () => {
    const cleanUrl = /^[a-z]+:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    if (!url.trim() || !isSafeHttpUrl(cleanUrl)) {
      setError('Enter a web link, like https://youtu.be/…');
      return;
    }
    if (links.length >= LIMITS.links) {
      setError(`You can keep up to ${LIMITS.links} links per problem.`);
      return;
    }
    const host = new URL(cleanUrl).hostname.replace(/^www\./, '');
    save([...links, { id: newId('link'), label: label.trim().slice(0, LIMITS.linkLabel) || host, url: cleanUrl }]);
    setLabel('');
    setUrl('');
  };

  return (
    <section aria-labelledby={labelId} className="dsa-card">
      <h2 id={labelId} className="dsa-section-title">
        Reference links
      </h2>
      <p className="mb-2 text-sm text-[var(--dsa-muted)]">Videos, articles, your own write-ups.</p>
      {links.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {links.map((link) =>
            editing === link.id ? (
              <li key={link.id} className="grid gap-2 rounded-lg bg-[var(--dsa-soft)] p-2">
                <EditLink
                  link={link}
                  onCancel={() => setEditing(null)}
                  onSave={(next) => {
                    save(links.map((item) => (item.id === link.id ? next : item)));
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={link.id} className="flex items-center gap-2 rounded-lg bg-[var(--dsa-soft)] py-1 pl-3 pr-1">
                <a href={link.url} target="_blank" rel="noreferrer noopener" className="dsa-link min-w-0 flex-1 truncate">
                  {link.label || link.url}
                </a>
                <button type="button" className="dsa-text-btn" onClick={() => setEditing(link.id)} aria-label={`Edit link ${link.label}`}>
                  Edit
                </button>
                <button type="button" className="dsa-icon-btn !size-9" onClick={() => save(links.filter((item) => item.id !== link.id))} aria-label={`Remove link ${link.label}`}>
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="mb-3 text-sm">No links yet.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
        <label className="sr-only" htmlFor={`${labelId}-label`}>
          Link name
        </label>
        <input
          id={`${labelId}-label`}
          className="dsa-input"
          placeholder="Name (optional)"
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            setError('');
          }}
        />
        <label className="sr-only" htmlFor={`${labelId}-url`}>
          Link address
        </label>
        <input
          id={`${labelId}-url`}
          className="dsa-input"
          placeholder="https://…"
          inputMode="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
      </div>
      <button type="button" className="dsa-btn-secondary mt-2" onClick={add}>
        <Plus className="size-4" aria-hidden /> Add link
      </button>
      {error && (
        <p className="mt-1 text-sm font-semibold text-[var(--dsa-danger)]" role="alert">
          {error}
        </p>
      )}
      {progress.links && problem.defaultLinks?.length ? (
        <button type="button" className="dsa-text-btn ml-3 mt-2" onClick={() => change({ links: null })}>
          Reset to the sheet’s suggested links
        </button>
      ) : null}
    </section>
  );
}

function EditLink({ link, onSave, onCancel }: { link: RefLink; onSave: (link: RefLink) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(link.label);
  const [url, setUrl] = useState(link.url);
  const valid = isSafeHttpUrl(url.trim());
  return (
    <>
      <input className="dsa-input" aria-label="Link name" value={label} onChange={(event) => setLabel(event.target.value)} />
      <input className="dsa-input" aria-label="Link address" value={url} onChange={(event) => setUrl(event.target.value)} />
      {!valid && <p className="text-sm text-[var(--dsa-danger)]">Enter a full web link starting with https://</p>}
      <div className="flex gap-2">
        <button type="button" className="dsa-btn-primary" disabled={!valid} onClick={() => onSave({ ...link, label: label.trim().slice(0, LIMITS.linkLabel), url: url.trim() })}>
          Save link
        </button>
        <button type="button" className="dsa-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </>
  );
}
