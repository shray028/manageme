import { AlertTriangle, Check, CloudOff, HardDrive, Loader2, ShieldAlert } from 'lucide-react';
import type { SyncStatus } from '@/lib/dsa/sync';

/**
 * One line, fixed height, so the page never jumps while someone is clicking.
 * The full explanation is available on hover and to screen readers.
 */
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
    text = 'Not saved yet · retrying';
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
    <div className="flex h-9 items-center gap-2 whitespace-nowrap">
      <p
        role="status"
        aria-live="polite"
        className={`flex items-center gap-1.5 text-sm font-semibold ${tone}`}
        data-testid="save-status"
        data-state={state}
        title={problem ? message : undefined}
      >
        {icon}
        {text}
        {problem && <span className="sr-only">. {message}</span>}
      </p>
      {problem && (
        <button type="button" onClick={onRetry} className="dsa-btn-secondary !min-h-8 !px-2.5 !py-1 text-sm">
          Retry now
        </button>
      )}
      {!deviceBackup && (
        <span
          className="flex items-center gap-1 text-sm font-semibold text-[var(--dsa-warn)]"
          title="This browser isn’t allowing a backup copy on this device, so keep this tab open until changes show as saved."
        >
          <HardDrive className="size-4" aria-hidden /> No device backup
          <span className="sr-only">: this browser isn’t allowing a backup copy on this device, so keep this tab open until changes show as saved.</span>
        </span>
      )}
    </div>
  );
}
