'use client';

import { useState } from 'react';
import { Check, ChevronRight, Cloud, LogOut, WifiOff } from 'lucide-react';
import { roadmapWeeks } from './roadmap-data';

type SavedDay = { id: number; checks?: boolean[]; status: string };
type Props = {
  name: string;
  project: { title: string; cards?: SavedDay[] };
  syncState: 'idle' | 'saving' | 'saved' | 'offline' | 'error';
  syncError: string;
  hasOldData: boolean;
  onCheck: (day: number, index: number, checked: boolean, totalChecks: number) => void;
  onClearOldData: () => void;
  onRetrySync: () => void;
  onSignOut: () => void;
};

const gates: Record<number, string> = {
  1: 'Process a new JSON file, handle bad records deliberately, and pass six useful tests.',
  2: 'Gate A: two easy Python problems, a cache core, and clear language explanations without copying.',
  3: 'Demonstrate health, readiness, batch inference, and history with API and service tests.',
  4: 'Gate B: implement a persisted endpoint with three tests and explain a query plan and async behavior.',
  5: 'Show a timeout, duplicate request, stale-cache fix, and calculate toy Hit@5.',
  6: 'Gate C: train, save, load, and serve a tiny real model; show metrics and one failure case.',
  7: 'Run the service from instructions, rerun the data pipeline, and explain a measured bottleneck.',
  8: 'Gate D: timed coding, implementation, design, and project walkthrough with honest evidence.',
  9: 'Repeat the weakest area, tailor applications, and rehearse six genuine work stories.',
};

export function RoadmapView({
  name,
  project,
  syncState,
  syncError,
  hasOldData,
  onCheck,
  onClearOldData,
  onRetrySync,
  onSignOut,
}: Props) {
  const saved = new Map((project.cards ?? []).map((card) => [card.id, card]));
  const isDone = (day: { day: number; lab: string }) => {
    const checks = saved.get(day.day)?.checks;
    return Boolean(checks?.slice(0, day.lab ? 2 : 1).length === (day.lab ? 2 : 1) &&
      checks?.slice(0, day.lab ? 2 : 1).every(Boolean));
  };
  const firstIncomplete = roadmapWeeks.find((week) => week.days.some((day) => !isDone(day)))?.number ?? 9;
  const [selectedWeek, setSelectedWeek] = useState(firstIncomplete);
  const week = roadmapWeeks.find((item) => item.number === selectedWeek) ?? roadmapWeeks[0];
  const days = roadmapWeeks.flatMap((item) => item.days);
  const completed = days.filter(isDone).length;
  const activeDay = days.find((day) => !isDone(day))?.day ?? 60;
  const percent = Math.round((completed / 60) * 100);

  return (
    <main className="min-h-screen bg-[#f6f5f1] text-stone-900">
      <header className="border-b border-stone-200 bg-white/90 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-teal-700 font-bold text-white">m</span>
            <div>
              <p className="font-semibold tracking-tight">ManageMe</p>
              <p className="text-xs text-stone-500">Python backend · ML systems</p>
            </div>
          </div>
          <button onClick={onSignOut} className="flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900" aria-label="Sign out of ManageMe">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
        <div className="rounded-3xl bg-[#143b38] p-6 text-white shadow-lg sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-teal-200">Your 60-day practice plan</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {name}. Build it yourself, one day at a time.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-teal-50/80">
            Rebuild Python fluency, a tested FastAPI sentiment service, SQL and reliability skills, then serve a small real PyTorch model. Plan for 12–15 hours each week. Work through days in order; the date is up to you.
          </p>
          <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div><span className="text-3xl font-bold">{completed}/60</span><span className="ml-2 text-sm text-teal-100">days complete</span></div>
            <div className="min-w-[180px] flex-1 sm:max-w-sm">
              <div className="mb-1.5 flex justify-between text-xs text-teal-100"><span>Progress</span><span>{percent}%</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-teal-300 transition-all" style={{ width: `${percent}%` }} /></div>
            </div>
            <button onClick={() => setSelectedWeek(Math.min(9, Math.ceil(activeDay / 7)))} className="rounded-xl bg-teal-200 px-4 py-2.5 text-sm font-bold text-teal-950 hover:bg-teal-100">
              Continue with Day {activeDay} <ChevronRight className="ml-1 inline size-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            {syncState === 'offline' ? <WifiOff className="size-3.5" /> : <Cloud className="size-3.5" />}
            {syncState === 'saving' ? 'Saving progress…' : syncState === 'offline' ? 'Offline — progress is waiting on this device' : syncState === 'error' ? 'Progress has not reached the cloud' : 'Progress saved to your account'}
          </span>
          {(syncState === 'error' || syncState === 'offline') && <button onClick={onRetrySync} className="font-bold text-teal-700 underline">Retry sync</button>}
          {syncError && <span className="text-rose-700">{syncError}</span>}
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside>
            <p className="mb-3 text-xs font-bold uppercase tracking-[.12em] text-stone-500">Choose a week</p>
            <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col" aria-label="Roadmap weeks">
              {roadmapWeeks.map((item) => {
                const done = item.days.filter(isDone).length;
                return <button key={item.number} onClick={() => setSelectedWeek(item.number)} className={`min-w-36 rounded-xl border px-3 py-3 text-left transition lg:w-full ${selectedWeek === item.number ? 'border-teal-500 bg-teal-50 text-teal-950' : 'border-stone-200 bg-white text-stone-700 hover:border-teal-200'}`} aria-current={selectedWeek === item.number ? 'step' : undefined}>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-teal-700">{item.number === 9 ? 'Days 57–60' : `Week ${item.number}`}</span>
                  <span className="mt-1 block text-sm font-semibold leading-tight">{item.title}</span>
                  <span className="mt-1.5 block text-xs text-stone-500">{done}/{item.days.length} days</span>
                </button>;
              })}
            </nav>
            {hasOldData && <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-950">
              <p className="font-bold">Old workspace items remain in your account.</p>
              <p className="mt-1 leading-relaxed">Remove old daily tasks, other projects, and the eight placeholder week cards. Your completed roadmap days will stay.</p>
              <button onClick={onClearOldData} className="mt-3 rounded-lg border border-orange-300 bg-white px-3 py-2 font-bold hover:bg-orange-100">Clear unrelated items</button>
            </div>}
          </aside>

          <section className="min-w-0">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-teal-700">{week.number === 9 ? 'Final four days' : `Week ${week.number}`} · {week.days.reduce((total, day) => total + day.minutes, 0) / 60} hours</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">{week.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{week.outcome}</p>
              <div className="mt-4 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-950"><strong>Checkpoint:</strong> {gates[week.number]}</div>
            </div>

            <div className="mt-4 space-y-3">
              {week.days.map((day) => {
                const checks = saved.get(day.day)?.checks ?? [];
                const tasks = day.lab ? [day.coding, day.lab] : [day.coding];
                const done = isDone(day);
                return <article key={day.day} className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${done ? 'border-teal-200' : 'border-stone-200'}`}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`grid size-8 place-items-center rounded-lg text-xs font-bold ${done ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-700'}`}>{done ? <Check className="size-4" /> : day.day}</span>
                      <h3 className="text-sm font-bold">Day {day.day}</h3>
                      {day.day === activeDay && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">Up next</span>}
                    </div>
                    <span className="text-xs text-stone-500">{day.minutes === 240 ? '4 hours' : day.minutes === 60 ? '1 hour' : '90 minutes'}</span>
                  </div>
                  <div className="space-y-3">
                    {tasks.map((task, index) => <label key={index} className="flex cursor-pointer items-start gap-3 rounded-xl bg-stone-50 p-3 text-sm leading-relaxed text-stone-700 hover:bg-teal-50/60">
                      <input type="checkbox" checked={Boolean(checks[index])} onChange={(event) => onCheck(day.day, index, event.target.checked, tasks.length)} aria-label={`Day ${day.day} ${index === 0 ? 'coding' : 'lab'} complete`} className="mt-0.5 size-4 shrink-0 accent-teal-700" />
                      <span><span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-teal-700">{day.lab ? index === 0 ? 'Python / coding' : 'Build / evidence' : 'Consolidation'}</span><span className={checks[index] ? 'text-stone-500 line-through' : ''}>{task}</span>{index === 0 && day.problemUrl && <a href={day.problemUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="ml-1 font-semibold text-indigo-700 underline">Open problem ↗</a>}</span>
                    </label>)}
                  </div>
                </article>;
              })}
            </div>
            <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
              <p className="font-bold text-stone-900">Practice rule</p>
              <p className="mt-1">Attempt the code before opening a solution. Use hints after your attempt; complete checkpoints and mocks without AI. Re-solve mistakes in review slots at about +2, +7, and +21 days.</p>
              <p className="mt-3 text-xs text-stone-500">Reference: <a className="text-teal-700 underline" href="https://docs.python.org/3/tutorial/" target="_blank" rel="noreferrer">Python</a> · <a className="text-teal-700 underline" href="https://fastapi.tiangolo.com/tutorial/" target="_blank" rel="noreferrer">FastAPI</a> · <a className="text-teal-700 underline" href="https://docs.pytest.org/en/stable/getting-started.html" target="_blank" rel="noreferrer">pytest</a> · <a className="text-teal-700 underline" href="https://docs.pytorch.org/tutorials/" target="_blank" rel="noreferrer">PyTorch</a></p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
