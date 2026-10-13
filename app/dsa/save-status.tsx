import { AlertTriangle, Check, CloudOff, Loader2, ShieldAlert } from 'lucide-react';
import type { SyncStatus } from '@/lib/dsa/sync';

export function SaveStatus({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  const { state, unsaved, message, deviceBackup } = status;
  let icon = <Check className="size-4" aria-hidden />;
  let text = 'All changes saved';
  let tone = 'text-[var(--dsa-done)]';
  if (state === 'saving' || (unsaved > 0 && state !== 'retrying' && state !== 'offline' && state !== 'blocked')) {
    icon = <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />;
    text = 'Saving…';
    tone = 'text-[var(--dsa-muted)]';
  } else if (state === 'offline') {
    icon = <CloudOff className="size-4" aria-hidden />;
    text = `Offline · ${unsaved} change${unsaved === 1 ? '' : 's'} kept on this device`;
    tone = 'text-[var(--dsa-warn)]';
  } else if (state === 'retrying') {
    icon = <AlertTriangle className="size-4" aria-hidden />;
    text = `Not saved yet · retrying`;
    tone = 'text-[var(--dsa-warn)]';
  } else if (state === 'blocked') {
    icon = <ShieldAlert className="size-4" aria-hidden />;
    text = 'Save refused by the server';
    tone = 'text-[var(--dsa-danger)]';
  } else if (state === 'idle') {
    text = 'Saved to your account';
  }
  const problem = state === 'retrying' || state === 'offline' || state === 'blocked';
  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <p role="status" aria-live="polite" className={`flex items-center gap-1.5 text-sm font-semibold ${tone}`} data-testid="save-status" data-state={state}>
        {icon}
        {text}
      </p>
      {problem && (
        <div className="flex max-w-sm items-start gap-2 text-sm text-[var(--dsa-ink)]">
          <span>{message}</span>
          <button type="button" onClick={onRetry} className="dsa-btn-secondary shrink-0 !px-2 !py-1">
            Retry now
          </button>
        </div>
      )}
      {!deviceBackup && (
        <p className="max-w-sm text-sm text-[var(--dsa-warn)]">This browser isn’t allowing a backup copy on this device, so keep this tab open until changes show as saved.</p>
      )}
    </div>
  );
}
