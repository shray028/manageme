import { useId, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { lookupProblem } from '@/lib/dsa/client-import';
import { parseSource, safeDocId } from '@/lib/dsa/leetcode';
import { isSafeHttpUrl, newId } from '@/lib/dsa/model';
import { LIMITS, type SheetProblem } from '@/lib/dsa/types';

type Props = {
  groups: string[];
  existingKeys: Set<string>;
  onAdd: (problem: SheetProblem) => void;
};

const OWN_GROUP = 'Added by me';

export function AddProblem({ groups, existingKeys, onAdd }: Props) {
  const id = useId();
  const [value, setValue] = useState('');
  const [link, setLink] = useState('');
  const [group, setGroup] = useState(OWN_GROUP);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const source = parseSource(value);
  const isLeetCodeLink = source?.kind === 'problem';
  const choices = [...new Set([OWN_GROUP, ...groups])];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = value.trim();
    if (!input) {
      setMessage({ tone: 'error', text: 'Type a problem name or paste a LeetCode problem link.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (source?.kind === 'problem') {
        const { problem, verified } = await lookupProblem(source.slug, group);
        if (existingKeys.has(problem.key)) {
          setMessage({ tone: 'warn', text: `“${problem.title}” is already in this list.` });
          return;
        }
        onAdd(problem);
        setMessage(
          verified
            ? { tone: 'ok', text: `Added ${problem.number ? `${problem.number}. ` : ''}${problem.title}.` }
            : { tone: 'warn', text: `Added “${problem.title}”. LeetCode couldn’t be reached, so the name comes from the link and the number is missing.` },
        );
      } else if (source && source.kind !== 'other' && /^https?:\/\//i.test(input)) {
        setMessage({ tone: 'error', text: 'That LeetCode link isn’t a single problem. To add a whole list, use “Import a list” on the DSA home page.' });
        return;
      } else {
        const url = link.trim() ? (/^[a-z]+:\/\//i.test(link.trim()) ? link.trim() : `https://${link.trim()}`) : '';
        if (url && !isSafeHttpUrl(url)) {
          setMessage({ tone: 'error', text: 'The link must be a web address, like https://…' });
          return;
        }
        const title = source?.kind === 'other' ? input : input.slice(0, LIMITS.title);
        onAdd({ key: safeDocId(newId('custom')), title, url: url || (source?.kind === 'other' ? source.url : null), group });
        setMessage({ tone: 'ok', text: `Added “${title}”.` });
      }
      setValue('');
      setLink('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="dsa-panel grid gap-3" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="dsa-h3">
        Add a problem
      </h3>
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor={`${id}-value`} className="dsa-label">
            Problem name or LeetCode link
          </label>
          <input
            id={`${id}-value`}
            className="dsa-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="https://leetcode.com/problems/two-sum/  or  Kadane’s algorithm"
            maxLength={2000}
          />
          <p className="mt-1 text-sm text-[var(--dsa-muted)]">A LeetCode link fills in the number and title for you.</p>
        </div>
        <div>
          <label htmlFor={`${id}-group`} className="dsa-label">
            Put it under
          </label>
          <select id={`${id}-group`} className="dsa-input" value={group} onChange={(event) => setGroup(event.target.value)}>
            {choices.map((choice) => (
              <option key={choice}>{choice}</option>
            ))}
          </select>
        </div>
      </div>
      {!isLeetCodeLink && value.trim() && source?.kind !== 'other' && (
        <div>
          <label htmlFor={`${id}-link`} className="dsa-label">
            Link to the problem (optional)
          </label>
          <input id={`${id}-link`} className="dsa-input" value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://www.geeksforgeeks.org/…" inputMode="url" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="dsa-btn-primary" disabled={busy}>
          <Plus className="size-4" aria-hidden /> {busy ? 'Looking it up…' : 'Add problem'}
        </button>
        {message && (
          <p role="status" className={`text-sm font-semibold ${message.tone === 'ok' ? 'text-[var(--dsa-done)]' : message.tone === 'warn' ? 'text-[var(--dsa-warn)]' : 'text-[var(--dsa-danger)]'}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
