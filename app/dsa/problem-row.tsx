import { lazy, memo, Suspense, useId, useState } from 'react';
import { Bookmark, ChevronDown, ExternalLink, History, Plus, Trash2, X } from 'lucide-react';
import { effectiveLinks, isDueForRevision, isSafeHttpUrl, newId } from '@/lib/dsa/model';
import { LIMITS, type Language, type Progress, type RefLink, type SheetProblem } from '@/lib/dsa/types';

const CodeEditor = lazy(() => import('./code-editor'));

const LANGUAGE_LABELS: Record<Language, string> = {
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  go: 'Go',
  text: 'Plain notes',
};

const difficultyClass = (problem: SheetProblem) => {
  const label = problem.difficulty ?? problem.tier;
  if (label === 'Easy' || label === 'basic') return 'dsa-tag-easy';
  if (label === 'Medium' || label === 'core') return 'dsa-tag-medium';
  if (label === 'Hard' || label === 'pro') return 'dsa-tag-hard';
  return 'dsa-tag-neutral';
};

const formatDate = (millis: number | null) =>
  millis ? new Date(millis).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

type RowProps = {
  problem: SheetProblem;
  progress: Progress;
  open: boolean;
  now: number;
  darkEditor: boolean;
  onToggleOpen: (key: string) => void;
  onChange: (key: string, patch: Partial<Progress>, problem: SheetProblem) => void;
  onBlur: () => void;
  onShowHistory: (problem: SheetProblem) => void;
  onHide?: (problem: SheetProblem) => void;
};

function ProblemRowInner({ problem, progress, open, now, darkEditor, onToggleOpen, onChange, onBlur, onShowHistory, onHide }: RowProps) {
  const detailsId = useId();
  const change = (patch: Partial<Progress>) => onChange(problem.key, patch, problem);
  const due = isDueForRevision(progress, now);
  const hasNotes = Boolean(progress.code || progress.completedNote || progress.revisedNote || progress.mistake);
  const label = problem.difficulty ?? problem.tier;

  return (
    <li className={`dsa-row ${progress.completed ? 'is-done' : ''}`} data-testid="problem-row" data-key={problem.key}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <label className="dsa-check">
            <input
              type="checkbox"
              checked={progress.completed}
              onChange={(event) => change(event.target.checked ? { completed: true, completedAt: progress.completedAt ?? Date.now() } : { completed: false, completedAt: null })}
            />
            <span>Done</span>
          </label>
          <label className="dsa-check dsa-check-revised">
            <input
              type="checkbox"
              checked={progress.revised}
              onChange={(event) =>
                change(
                  event.target.checked
                    ? { revised: true, revisedAt: Date.now(), revisionCount: progress.revisionCount + 1, ...(progress.completed ? {} : { completed: true, completedAt: progress.completedAt ?? Date.now() }) }
                    : { revised: false },
                )
              }
            />
            <span>Revised</span>
          </label>
        </div>

        <button
          type="button"
          className="dsa-row-title order-first min-w-0 basis-full text-left sm:order-none sm:basis-0 sm:flex-1"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => onToggleOpen(problem.key)}
        >
          <span className="flex flex-wrap items-baseline gap-x-2">
            {problem.number && <span className="text-[var(--dsa-muted)]">{problem.number}.</span>}
            <span className="font-semibold">{problem.title}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-[var(--dsa-muted)]">
            {label && <span className={`dsa-tag ${difficultyClass(problem)}`}>{label}</span>}
            {due && <span className="dsa-tag dsa-tag-due">Due for revision</span>}
            {progress.revised && progress.revisionCount > 1 && <span>Revised {progress.revisionCount}×</span>}
            {hasNotes && <span>Has notes</span>}
          </span>
        </button>

        <div className="ml-auto flex items-center sm:ml-0 sm:gap-1">
          <button
            type="button"
            className={`dsa-icon-btn ${progress.bookmarked ? 'is-on' : ''}`}
            aria-pressed={progress.bookmarked}
            aria-label={progress.bookmarked ? `Remove ${problem.title} from weak list` : `Add ${problem.title} to weak list`}
            title={progress.bookmarked ? 'On your weak list' : 'Add to weak list'}
            onClick={() => change({ bookmarked: !progress.bookmarked })}
          >
            <Bookmark className="size-5" fill={progress.bookmarked ? 'currentColor' : 'none'} aria-hidden />
          </button>
          {problem.url && (
            <a className="dsa-icon-btn" href={problem.url} target="_blank" rel="noreferrer noopener" aria-label={`Open ${problem.title} (new tab)`} title="Open problem">
              <ExternalLink className="size-5" aria-hidden />
            </a>
          )}
          <button type="button" className="dsa-icon-btn" aria-label={`${open ? 'Close' : 'Open'} notes for ${problem.title}`} aria-expanded={open} aria-controls={detailsId} onClick={() => onToggleOpen(problem.key)}>
            <ChevronDown className={`size-5 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
      </div>

      {open && (
        <section id={detailsId} className="dsa-details" aria-label={`Notes for ${problem.title}`}>
          <ProblemDetails problem={problem} progress={progress} darkEditor={darkEditor} change={change} onBlur={onBlur} onShowHistory={() => onShowHistory(problem)} onHide={onHide ? () => onHide(problem) : undefined} />
        </section>
      )}
    </li>
  );
}

export const ProblemRow = memo(ProblemRowInner);

function ProblemDetails({
  problem,
  progress,
  darkEditor,
  change,
  onBlur,
  onShowHistory,
  onHide,
}: {
  problem: SheetProblem;
  progress: Progress;
  darkEditor: boolean;
  change: (patch: Partial<Progress>) => void;
  onBlur: () => void;
  onShowHistory: () => void;
  onHide?: () => void;
}) {
  const codeLabelId = useId();
  const tooLong = progress.code.length >= LIMITS.code;
  return (
    <div className="grid gap-6 px-4 pb-5 pt-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section aria-labelledby={codeLabelId} className="min-w-0">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h4 id={codeLabelId} className="dsa-h4">
            Code &amp; notes
          </h4>
          <label className="flex items-center gap-2 text-sm">
            <span>Language</span>
            <select className="dsa-input !w-auto !py-1.5" value={progress.language} onChange={(event) => change({ language: event.target.value as Language })}>
              {Object.entries(LANGUAGE_LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Suspense fallback={<textarea className="dsa-input min-h-[220px] font-mono" value={progress.code} readOnly aria-label="Loading editor" />}>
          <CodeEditor
            value={progress.code}
            language={progress.language}
            dark={darkEditor}
            label={`Code and notes for ${problem.title}`}
            onChange={(code) => change({ code: code.slice(0, LIMITS.code) })}
            onBlur={onBlur}
          />
        </Suspense>
        <p className="mt-2 text-sm text-[var(--dsa-muted)]">Tab indents. Press Esc, then Tab, to move out of the editor.</p>
        {tooLong && <p className="mt-1 text-sm font-semibold text-[var(--dsa-danger)]">This box is full ({LIMITS.code.toLocaleString()} characters). Anything longer won’t be saved.</p>}
      </section>

      <div className="flex min-w-0 flex-col gap-5">
        <NoteField
          label="When I solved it"
          hint={progress.completed ? `Marked done ${formatDate(progress.completedAt)}` : 'Approach, complexity, the pattern it uses'}
          value={progress.completedNote}
          onChange={(value) => change({ completedNote: value })}
          onBlur={onBlur}
          placeholder="This is a … problem because …"
        />
        <NoteField
          label="When I revised it"
          hint={progress.revised ? `Last revised ${formatDate(progress.revisedAt)}${progress.revisionCount > 1 ? ` · ${progress.revisionCount} times` : ''}` : 'What you remembered, what you forgot'}
          value={progress.revisedNote}
          onChange={(value) => change({ revisedNote: value })}
          onBlur={onBlur}
          placeholder="Re-solved cold? What tripped you up?"
        />
        {progress.revised && (
          <button type="button" className="dsa-btn-secondary self-start" onClick={() => change({ revisedAt: Date.now(), revisionCount: progress.revisionCount + 1 })}>
            I revised it again today
          </button>
        )}
        <div className="rounded-xl border border-[var(--dsa-line)] p-3">
          <label className="dsa-check mb-2">
            <input type="checkbox" checked={progress.bookmarked} onChange={(event) => change({ bookmarked: event.target.checked })} />
            <span>On my weak list</span>
          </label>
          <NoteField
            label="Mistake to remember"
            hint="Shows up when you filter by weak list"
            value={progress.mistake}
            onChange={(value) => change({ mistake: value })}
            onBlur={onBlur}
            placeholder="e.g. Forgot the empty-array case"
          />
        </div>
        <LinksEditor problem={problem} progress={progress} change={change} />
        <div className="flex flex-wrap gap-2 border-t border-[var(--dsa-line)] pt-3">
          <button type="button" className="dsa-btn-secondary" onClick={onShowHistory}>
            <History className="size-4" aria-hidden /> Earlier versions
          </button>
          {onHide && (
            <button type="button" className="dsa-btn-secondary" onClick={onHide}>
              <Trash2 className="size-4" aria-hidden /> Remove from this list
            </button>
          )}
        </div>
      </div>
    </div>
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
    <div>
      <label htmlFor={id} className="dsa-h4 block">
        {label}
      </label>
      <p id={`${id}-hint`} className="mb-1.5 text-sm text-[var(--dsa-muted)]">
        {hint}
      </p>
      <textarea
        id={id}
        aria-describedby={`${id}-hint`}
        className="dsa-input min-h-[88px]"
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
    <section aria-labelledby={labelId}>
      <h4 id={labelId} className="dsa-h4">
        Reference links
      </h4>
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
              <li key={link.id} className="flex items-center gap-2 rounded-lg bg-[var(--dsa-soft)] px-3 py-2">
                <a href={link.url} target="_blank" rel="noreferrer noopener" className="dsa-link min-w-0 flex-1 truncate">
                  {link.label || link.url}
                </a>
                <button type="button" className="dsa-text-btn" onClick={() => setEditing(link.id)} aria-label={`Edit link ${link.label}`}>
                  Edit
                </button>
                <button type="button" className="dsa-icon-btn !size-8" onClick={() => save(links.filter((item) => item.id !== link.id))} aria-label={`Remove link ${link.label}`}>
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="mb-3 text-sm">No links yet.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
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
        <button type="button" className="dsa-btn-secondary" onClick={add}>
          <Plus className="size-4" aria-hidden /> Add link
        </button>
      </div>
      {error && (
        <p className="mt-1 text-sm font-semibold text-[var(--dsa-danger)]" role="alert">
          {error}
        </p>
      )}
      {progress.links && problem.defaultLinks?.length ? (
        <button type="button" className="dsa-text-btn mt-2" onClick={() => change({ links: null })}>
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
