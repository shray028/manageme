import { useEffect, useRef, useState } from 'react';
import type { HistoryEntry } from '@/lib/dsa/remote';

const REASONS: Record<string, string> = {
  periodic: 'Saved automatically',
  'before-large-deletion': 'Saved before a large deletion',
  'unsynced-draft-from-older-session': 'Unsaved draft from another session',
  'before-restore': 'Saved before restoring an older version',
};

type Props = {
  title: string;
  load: () => Promise<HistoryEntry[]>;
  onRestore: (entry: HistoryEntry) => void;
  onClose: () => void;
};

export function HistoryDialog({ title, load, onRestore, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    ref.current?.showModal();
    load()
      .then(setEntries)
      .catch(() => setError('Earlier versions could not be loaded. Check your connection and try again.'));
  }, [load]);

  return (
    <dialog ref={ref} className="dsa-dialog" onClose={onClose} aria-labelledby="history-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="history-title" className="dsa-h2">
            Earlier versions
          </h2>
          <p className="text-[var(--dsa-muted)]">{title}</p>
        </div>
        <button type="button" className="dsa-btn-secondary" onClick={() => ref.current?.close()}>
          Close
        </button>
      </div>
      <p className="mt-3 text-sm">ManageMe keeps a copy of your code and notes every few minutes while you edit, and always before you delete a lot at once.</p>
      <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
        {error && <p role="alert" className="font-semibold text-[var(--dsa-danger)]">{error}</p>}
        {!entries && !error && <p>Loading…</p>}
        {entries?.length === 0 && <p>No earlier versions yet. They appear once you have edited this problem’s notes for a while.</p>}
        {entries?.map((entry) => (
          <article key={entry.id} className="rounded-xl border border-[var(--dsa-line)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {entry.savedAt ? new Date(entry.savedAt).toLocaleString() : 'Unknown time'}
                <span className="ml-2 font-normal text-[var(--dsa-muted)]">{REASONS[entry.reason] ?? 'Saved copy'}</span>
              </p>
              <button
                type="button"
                className="dsa-btn-primary"
                onClick={() => {
                  onRestore(entry);
                  ref.current?.close();
                }}
              >
                Restore this version
              </button>
            </div>
            {typeof entry.data.code === 'string' && entry.data.code && <pre className="dsa-pre mt-2">{entry.data.code.slice(0, 1200)}</pre>}
            {(['completedNote', 'revisedNote', 'mistake'] as const).map((field) =>
              typeof entry.data[field] === 'string' && entry.data[field] ? (
                <p key={field} className="mt-2 whitespace-pre-wrap text-sm">
                  <span className="font-semibold">{field === 'completedNote' ? 'When I solved it: ' : field === 'revisedNote' ? 'When I revised it: ' : 'Mistake: '}</span>
                  {(entry.data[field] as string).slice(0, 400)}
                </p>
              ) : null,
            )}
          </article>
        ))}
      </div>
    </dialog>
  );
}
