import { useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Cloud, Download, LayoutGrid, ShieldCheck, Upload } from 'lucide-react';
import { SHEETS, getSheet } from '@/lib/dsa/sheets';
import { listProblems, newId, toProgress } from '@/lib/dsa/model';
import { buildBackup, planRestore, type RestorePlan } from '@/lib/dsa/backup';
import type { DsaList } from '@/lib/dsa/types';
import type { DsaStore } from './use-dsa';

type Props = {
  store: DsaStore;
  lists: DsaList[];
  archived: DsaList[];
  userName: string;
  userEmail: string;
  onOpen: (listId: string) => void;
};

export function DsaHome({ store, lists, archived, userName, userEmail, onOpen }: Props) {
  const createList = (title: string, source: DsaList['source']) => {
    const id = newId('list');
    store.update('dsaLists', id, { title: title.slice(0, 300), source, problems: [], extraProblems: [], hiddenKeys: [], archived: false, createdAt: Date.now() });
    return id;
  };

  const startSheet = (sheetId: string) => {
    const existing = [...lists, ...archived].find((list) => list.source.kind === 'sheet' && list.source.sheetId === sheetId);
    if (existing) {
      if (existing.archived) store.update('dsaLists', existing.id, { archived: false });
      onOpen(existing.id);
      return;
    }
    const sheet = getSheet(sheetId);
    if (sheet) onOpen(createList(sheet.title, { kind: 'sheet', sheetId }));
  };

  const seenProblems = new Set<string>();
  let done = 0;
  for (const list of lists) {
    for (const problem of listProblems(list)) {
      if (seenProblems.has(problem.key)) continue;
      seenProblems.add(problem.key);
      if (toProgress(problem.key, store.get('dsaProgress', problem.key)).completed) done += 1;
    }
  }
  const practiceStats = { problems: seenProblems.size, done };
  const firstName = userName.trim().split(/\s+/)[0];
  const firstList = lists[0];

  return (
    <div className="dsa-dashboard">
      <nav className="dsa-dashboard-nav" aria-label="DSA sections">
        <p className="dsa-overline">NAVIGATE</p>
        <a className="is-current" href="#dsa-main"><LayoutGrid size={17} aria-hidden /> Overview</a>
        <a href="#sheets"><LayoutGrid size={17} aria-hidden /> Practice sheets</a>
        <div className="dsa-dashboard-nav-note"><ShieldCheck size={18} aria-hidden /><span>Your progress stays with your account.</span></div>
      </nav>

      <div className="dsa-dashboard-content">
        <header className="dsa-dashboard-intro">
          <p className="dsa-overline">YOUR PRACTICE SPACE</p>
          <h1 className="dsa-h1">{firstName ? `Hi ${firstName}, what are you practising?` : 'What are you practising?'}</h1>
          <p>Pick up a sheet, solve one problem, and keep what you learned close for next time.</p>
        </header>

        <div className="dsa-next-card">
          <span className="dsa-next-icon"><BookOpen size={19} aria-hidden /></span>
          <div><strong>{firstList ? `Pick up ${firstList.title}` : 'Start with one problem'}</strong><p>{firstList ? 'Your code, notes and revision history are ready where you left them.' : 'Choose a practice sheet below to begin at your own pace.'}</p></div>
          <button type="button" className="dsa-next-action" onClick={() => firstList ? onOpen(firstList.id) : document.getElementById('sheets')?.scrollIntoView({ behavior: 'smooth' })}>
            {firstList ? 'Continue practice' : 'Explore sheets'} <ArrowRight size={17} aria-hidden />
          </button>
        </div>

        {lists.length > 0 && (
          <section aria-labelledby="continue-title" className="dsa-dashboard-section">
            <div className="dsa-section-heading"><div><p className="dsa-overline">PICK UP WHERE YOU ARE</p><h2 id="continue-title" className="dsa-h2">Continue practising</h2></div><span>{lists.length} {lists.length === 1 ? 'sheet' : 'sheets'}</span></div>
            <ul className="dsa-my-lists">
              {lists.map((list) => <ListCard key={list.id} list={list} store={store} onOpen={() => onOpen(list.id)} />)}
            </ul>
          </section>
        )}

        <section id="sheets" aria-labelledby="sheets-title" className="dsa-dashboard-section">
          <div className="dsa-section-heading"><div><p className="dsa-overline">A CLEAR PLACE TO BEGIN</p><h2 id="sheets-title" className="dsa-h2">{lists.length ? 'Explore another sheet' : 'Start with a sheet'}</h2></div></div>
          <p className="dsa-section-description">Choose a trusted sheet. Every problem links to its original question.</p>
          <ul className="dsa-sheet-grid">
            {SHEETS.map((sheet) => {
              const started = lists.some((list) => list.source.kind === 'sheet' && list.source.sheetId === sheet.id);
              const groups = new Set(sheet.problems.map((problem) => problem.group)).size;
              return (
                <li key={sheet.id} className="dsa-panel dsa-sheet-card">
                  <div className="dsa-sheet-card-icon"><BookOpen size={19} aria-hidden /></div>
                  <div><h3 className="dsa-h3">{sheet.title}</h3><p>{sheet.description}</p></div>
                  <p className="dsa-sheet-meta">{sheet.problems.length} problems · {groups} {sheet.groupLabel.toLowerCase()} groups{sheet.subgroupLabel ? ` · ${sheet.subgroupLabel.toLowerCase()}s` : ''}</p>
                  <div className="dsa-sheet-actions"><button type="button" className="dsa-btn-primary" onClick={() => startSheet(sheet.id)}>{started ? 'Open' : 'Start this sheet'} <ArrowRight size={16} aria-hidden /></button><a className="dsa-link" href={sheet.sourceUrl} target="_blank" rel="noreferrer noopener">View original</a></div>
                </li>
              );
            })}
          </ul>
        </section>

        <details className="dsa-dashboard-section dsa-data-details">
          <summary>Data &amp; backup</summary>
          <div className="dsa-data-details-content">
            {archived.length > 0 && (
              <section aria-labelledby="archived">
                <h2 id="archived" className="dsa-h2 mb-2">Previously removed sheets</h2>
                <p className="mb-3 text-[var(--dsa-muted)]">Your notes are kept. Bring a sheet back any time.</p>
                <ul className="space-y-2">
                  {archived.map((list) => (
                    <li key={list.id} className="dsa-panel flex flex-wrap items-center justify-between gap-3 !py-3"><span>{list.title}</span><button type="button" className="dsa-btn-secondary" onClick={() => store.update('dsaLists', list.id, { archived: false })}>Bring back</button></li>
                  ))}
                </ul>
              </section>
            )}
            <BackupSection store={store} email={userEmail} />
          </div>
        </details>
      </div>

      <aside className="dsa-dashboard-rail" aria-label="Practice summary">
        <p className="dsa-overline">YOUR PROGRESS</p>
        <div className="dsa-rail-card"><p className="dsa-rail-card-label">Problems done</p><strong>{practiceStats.done}<span> / {practiceStats.problems}</span></strong><div className="dsa-progress" role="progressbar" aria-label="Overall problem progress" aria-valuemin={0} aria-valuemax={practiceStats.problems} aria-valuenow={practiceStats.done}><span style={{ width: `${practiceStats.problems ? Math.round(practiceStats.done / practiceStats.problems * 100) : 0}%` }} /></div><p>Every problem you return to adds up.</p></div>
        <div className="dsa-rail-tip"><Cloud size={20} aria-hidden /><div><strong>Saved as you go</strong><p>Your sheets and notes sync to your account. A backup is available below.</p></div></div>
      </aside>
    </div>
  );
}

function ListCard({ list, store, onOpen }: { list: DsaList; store: DsaStore; onOpen: () => void }) {
  const problems = listProblems(list);
  let done = 0;
  for (const problem of problems) if (toProgress(problem.key, store.get('dsaProgress', problem.key)).completed) done += 1;
  const percent = problems.length ? Math.round((done / problems.length) * 100) : 0;
  return (
    <li className="dsa-panel dsa-list-card">
      <span className="dsa-list-card-mark" aria-hidden><BookOpen size={20} /></span>
      <div className="dsa-list-card-body"><h3 className="dsa-h3">{list.title}</h3><p>{done} of {problems.length} done</p><div className="dsa-progress" role="progressbar" aria-label={`${list.title} progress`} aria-valuemin={0} aria-valuemax={problems.length} aria-valuenow={done}><div style={{ width: `${percent}%` }} /></div></div>
      <button type="button" className="dsa-list-card-open" onClick={onOpen}>Open sheet <ArrowRight size={17} aria-hidden /></button>
    </li>
  );
}

function BackupSection({ store, email }: { store: DsaStore; email: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<RestorePlan | null>(null);
  const [message, setMessage] = useState('');
  const counts = useMemo(() => {
    const snapshot = store.snapshot();
    return { lists: Object.keys(snapshot.dsaLists).length, problems: Object.keys(snapshot.dsaProgress).length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.version]);

  const download = () => {
    const backup = buildBackup(store.snapshot(), email);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `manageme-dsa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    setMessage('Backup downloaded.');
  };

  return (
    <section aria-labelledby="backup" className="dsa-panel">
      <h2 id="backup" className="dsa-h2">
        Your data
      </h2>
      <p className="mt-1">
        Everything saves to your account automatically and is kept on this device until the save is confirmed. You can also keep your own copy ({counts.lists} list
        {counts.lists === 1 ? '' : 's'}, {counts.problems} problem{counts.problems === 1 ? '' : 's'} with progress or notes).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="dsa-btn-secondary" onClick={download}>
          <Download className="size-4" aria-hidden /> Download backup
        </button>
        <button type="button" className="dsa-btn-secondary" onClick={() => input.current?.click()}>
          <Upload className="size-4" aria-hidden /> Restore from backup
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Choose a backup file"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setMessage('');
            try {
              if (file.size > 20 * 1024 * 1024) throw new Error('That file is too large to be a ManageMe backup.');
              setPlan(planRestore(await file.text(), store.snapshot()));
            } catch (error) {
              setMessage((error as Error).message);
            }
          }}
        />
      </div>
      {plan && (
        <div className="dsa-note mt-3" role="alert">
          {plan.changes.length === 0 ? (
            <p>Everything in that backup is already in your account. Nothing to restore.</p>
          ) : (
            <>
              <p>
                Restoring will add or update {plan.problems} problem{plan.problems === 1 ? '' : 's'} and {plan.lists} list{plan.lists === 1 ? '' : 's'}. Nothing is deleted: newer
                entries replace older ones, and otherwise only empty fields are filled in. Notes that get replaced are copied to each problem’s “Earlier versions” first.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="dsa-btn-primary"
                  onClick={() => {
                    for (const change of plan.changes) {
                      const existing = store.get(change.collection, change.id);
                      if (change.collection === 'dsaProgress' && existing && store.remote) {
                        const current = toProgress(change.id, existing);
                        if (current.code || current.completedNote || current.revisedNote || current.mistake)
                          void store.remote
                            .writeHistory('dsaProgress', change.id, {
                              savedAt: Date.now(),
                              reason: 'before-restore',
                              code: current.code,
                              completedNote: current.completedNote,
                              revisedNote: current.revisedNote,
                              mistake: current.mistake,
                              links: current.links,
                            })
                            .catch(() => undefined);
                      }
                      store.update(change.collection, change.id, change.patch);
                    }
                    setPlan(null);
                    setMessage('Backup restored. Saving to your account…');
                  }}
                >
                  Restore
                </button>
                <button type="button" className="dsa-btn-secondary" onClick={() => setPlan(null)}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="mt-2 font-semibold">
          {message}
        </p>
      )}
    </section>
  );
}
