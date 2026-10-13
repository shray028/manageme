# DSA tracker

Open it at `/#/dsa`. People who pick "Track DSA practice" on the start page (or open the DSA
tracker once) land straight on it next time.

## One-time setup (required)

The tracker stores data in two new Firestore sub-collections under each user
(`users/{uid}/dsaLists` and `users/{uid}/dsaProgress`). Deploy the rules in `firestore.rules`
so those writes are allowed and stay private:

```bash
pnpm deploy:rules        # = firebase deploy --only firestore:rules (log in with `npx firebase login` first)
```

If the rules are not deployed, saving shows "Save refused by the server" and every change stays on
the device until it can be saved — nothing is lost, but nothing reaches the account either.

## How data is kept safe

- Every edit is written to a per-tab backup in the browser *before* it is sent, and removed only
  after the server confirms that exact version. A crash, a closed tab or no network loses nothing;
  the next visit sends whatever was left.
- Saves are field-level merges, so two tabs or devices editing different notes never overwrite
  each other.
- Failed saves retry automatically with backoff; the header always says whether everything is saved.
- If loading fails, editing is paused instead of starting from empty data.
- Code and notes are snapshotted to "Earlier versions" every few minutes and always before a large
  deletion. The rules make that history append-only.
- Problems and lists are never deleted: "Remove" hides a problem or archives a list and keeps notes.
- "Download backup" exports everything as JSON; "Restore from backup" only adds or fills in.

## Tests

```bash
pnpm test                 # unit tests: save engine, LeetCode parsing/import, sheets, backups
pnpm test:e2e             # browser tests against a fake server that can fail on purpose
pnpm test:rules           # Firestore rules, needs Java (downloads the emulator once)
```

## Sheets

- `lib/dsa/sheets/strivers-a2z.json` — Striver's A2Z DSA Sheet (495 items), grouped by step
  and topic, with Striver's videos.
- `lib/dsa/sheets/neetcode-150.json` — NeetCode 150, grouped by topic, with NeetCode
  explanations and Striver's videos where available.
- `lib/dsa/sheets/strivers-180.json` — Striver's 180, copied from takeuforward.org (pattern →
  sub-pattern → problem, with Striver's video as the default reference link).
- LeetCode Top Interview Questions (easy, medium, hard) are bundled, so importing those links works
  even if LeetCode blocks the server. Other Explore cards and study plans are fetched live via
  `/api/leetcode`.
