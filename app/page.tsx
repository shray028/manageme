'use client';

import { FormEvent, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  ArrowUpRight, BrainCircuit, CalendarDays, Check, ChevronRight, CirclePlus,
  Cloud, Command, FolderKanban, Inbox, KeyRound, Lightbulb, LogIn, LogOut, Menu, MoreHorizontal,
  Plus, Search, Send, Settings2, Sparkles, Target, TimerReset, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { auth, db, googleProvider } from '@/lib/firebase';

type Task = {
  id: number;
  title: string;
  time: string;
  duration: string;
  tag: string;
  color: string;
  done?: boolean;
  priority?: boolean;
};
type Provider = 'grok' | 'openai' | 'claude';
type Feature = 'tasks' | 'habit' | 'projects' | 'planner';
type Project = { id: number; title: string; progress: number };
type WorkspaceProfile = { onboardingCompleted?: boolean; name?: string; focus?: string; features?: Feature[] };

const defaults: Task[] = [
  { id: 1, title: 'DSA: dynamic programming set', time: '9:00 AM', duration: '90 min', tag: 'DSA prep', color: 'indigo', priority: true },
  { id: 2, title: 'Review Q4 project brief', time: '11:00 AM', duration: '45 min', tag: 'Work', color: 'orange', priority: true },
  { id: 3, title: 'Submit internship applications', time: '4:00 PM', duration: '60 min', tag: 'Career', color: 'rose' },
  { id: 4, title: 'Call Mom', time: '6:30 PM', duration: '20 min', tag: 'Personal', color: 'emerald' },
];

const nav = [
  ['Today', CalendarDays],
  ['Inbox', Inbox],
  ['Planner', TimerReset],
  ['Projects', FolderKanban],
  ['Insights', BrainCircuit],
] as const;

const providerModels: Record<Provider, string> = {
  grok: 'grok-4.6',
  openai: 'gpt-5-mini',
  claude: 'claude-sonnet-4-6',
};

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: number) => void }) {
  return (
    <div className={`group flex items-center gap-3 rounded-xl px-2 py-2.5 transition ${task.done ? 'opacity-45' : 'hover:bg-stone-50'}`}>
      <button
        aria-label={`Mark ${task.title} as ${task.done ? 'incomplete' : 'complete'}`}
        onClick={() => onToggle(task.id)}
        className={`grid size-5 shrink-0 place-items-center rounded-full border ${task.done ? 'border-teal-500 bg-teal-500 text-white' : 'border-stone-300 text-transparent hover:border-teal-500'}`}
      >
        <Check className="size-3" strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] font-medium text-stone-800 ${task.done ? 'line-through' : ''}`}>{task.title}</p>
        <p className="mt-0.5 text-[11px] text-stone-400">{task.time} · {task.duration}</p>
      </div>
      <span className={`hidden rounded-md px-2 py-1 text-[10px] font-semibold sm:inline-block tag-${task.color}`}>{task.tag}</span>
      {task.priority && <span className="size-1.5 rounded-full bg-orange-400" aria-label="Priority task" />}
    </div>
  );
}

function NavigationPanel({ activeNav, tasks, projects, onAddProject }: { activeNav: string; tasks: Task[]; projects: Project[]; onAddProject: (title: string) => void }) {
  const [title, setTitle] = useState('');
  if (activeNav === 'Inbox') return <div className="rounded-2xl border border-stone-200 bg-white p-6"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700">Capture first</p><h2 className="mt-1 font-display text-2xl font-semibold">Inbox</h2><p className="mt-2 text-sm text-stone-500">Your captured tasks stay here until you decide where they belong.</p><div className="mt-6 space-y-2">{tasks.map((task) => <div key={task.id} className="rounded-xl bg-stone-50 px-4 py-3 text-sm font-medium text-stone-700">{task.title}</div>)}</div></div>;
  if (activeNav === 'Planner') return <div className="rounded-2xl border border-stone-200 bg-white p-6"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700">Keep it realistic</p><h2 className="mt-1 font-display text-2xl font-semibold">Planner</h2><div className="mt-6 space-y-3">{tasks.map((task) => <div key={task.id} className="flex items-center gap-4 rounded-xl bg-stone-50 px-4 py-3"><span className="w-24 text-xs font-bold text-teal-700">{task.time}</span><span className="text-sm font-medium text-stone-700">{task.title}</span></div>)}</div></div>;
  if (activeNav === 'Projects') return <div className="rounded-2xl border border-stone-200 bg-white p-6"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600">Longer direction</p><h2 className="mt-1 font-display text-2xl font-semibold">Projects</h2><p className="mt-2 text-sm text-stone-500">Add a project only when something deserves more than a to-do.</p><form onSubmit={(event) => { event.preventDefault(); onAddProject(title); setTitle(''); }} className="mt-6 flex gap-2"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Name a project or goal" /><Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">Add project</Button></form><div className="mt-5 grid gap-3 sm:grid-cols-2">{projects.length ? projects.map((project) => <div key={project.id} className="rounded-xl border border-stone-200 p-4"><p className="font-semibold text-stone-800">{project.title}</p><Progress value={project.progress} className="mt-4 [&_[data-slot=progress-indicator]]:bg-indigo-500" /></div>) : <p className="text-sm text-stone-400">No projects yet.</p>}</div></div>;
  return <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-[11px] text-stone-400">Tasks completed</p><p className="mt-2 font-display text-3xl font-semibold">{tasks.filter((task) => task.done).length}/{tasks.length}</p></div><div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-[11px] text-stone-400">Projects</p><p className="mt-2 font-display text-3xl font-semibold">{projects.length}</p></div><div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-[11px] text-stone-400">A gentle reminder</p><p className="mt-2 text-sm font-medium text-stone-700">Progress is a pattern, not a score.</p></div></div>;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(defaults);
  const [activeNav, setActiveNav] = useState('Today');
  const [quickAdd, setQuickAdd] = useState('');
  const [habitDone, setHabitDone] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState<Provider>('grok');
  const [model, setModel] = useState(providerModels.grok);
  const [apiKey, setApiKey] = useState('');
  const [memoPrompt, setMemoPrompt] = useState('');
  const [memoAnswer, setMemoAnswer] = useState('');
  const [memoError, setMemoError] = useState('');
  const [memoLoading, setMemoLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<WorkspaceProfile>({});
  const [showSetup, setShowSetup] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupFocus, setSetupFocus] = useState('Personal life');
  const [setupFeatures, setSetupFeatures] = useState<Feature[]>(['tasks', 'habit']);
  const [setupTask, setSetupTask] = useState('');
  const [setupHabit, setSetupHabit] = useState('');
  const [setupProject, setSetupProject] = useState('');

  useEffect(() => {
    const savedProvider = window.sessionStorage.getItem('memo-provider') as Provider | null;
    const savedModel = window.sessionStorage.getItem('memo-model');
    const savedKey = window.sessionStorage.getItem('memo-api-key');
    if (savedProvider) setProvider(savedProvider);
    if (savedModel) setModel(savedModel);
    if (savedKey) setApiKey(savedKey);
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem('memo-provider', provider);
    window.sessionStorage.setItem('memo-model', model);
    window.sessionStorage.setItem('memo-api-key', apiKey);
  }, [provider, model, apiKey]);
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setCloudReady(false);
      setAuthError('');
      if (!nextUser) {
        setTasks(defaults);
        setHabitDone(false);
        setProjects([]);
        setProfile({});
        return;
      }

      try {
        const workspace = doc(db, 'users', nextUser.uid);
        const snapshot = await getDoc(workspace);
        if (!active) return;
        if (snapshot.exists()) {
          const saved = snapshot.data() as { tasks?: Task[]; habitDone?: boolean; projects?: Project[]; profile?: WorkspaceProfile };
          if (Array.isArray(saved.tasks)) setTasks(saved.tasks);
          setHabitDone(Boolean(saved.habitDone));
          if (Array.isArray(saved.projects)) setProjects(saved.projects);
          const loadedProfile = saved.profile ?? {};
          setProfile(loadedProfile);
          setSetupName(loadedProfile.name || nextUser.displayName?.split(' ')[0] || '');
          setSetupFocus(loadedProfile.focus || 'Personal life');
          setSetupFeatures(loadedProfile.features?.length ? loadedProfile.features : ['tasks', 'habit']);
          if (!loadedProfile.onboardingCompleted) setShowSetup(true);
        } else {
          // Bring any existing device-only data into the new account once.
          const legacyTasks = window.localStorage.getItem('manageme-tasks');
          const legacyHabit = window.localStorage.getItem('manageme-habit') === 'true';
          const initialTasks = legacyTasks ? JSON.parse(legacyTasks) as Task[] : defaults;
          setTasks(initialTasks);
          setHabitDone(legacyHabit);
          await setDoc(workspace, {
            tasks: initialTasks,
            habitDone: legacyHabit,
            projects: [],
            profile: { name: nextUser.displayName ?? '', email: nextUser.email ?? '' },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          window.localStorage.removeItem('manageme-tasks');
          window.localStorage.removeItem('manageme-habit');
          setSetupName(nextUser.displayName?.split(' ')[0] || '');
          setShowSetup(true);
        }
        if (active) setCloudReady(true);
      } catch (error) {
        if (active) setAuthError(error instanceof Error ? error.message : 'Your workspace could not be loaded.');
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!user || !cloudReady) return;
    const timeout = window.setTimeout(() => {
      setDoc(doc(db, 'users', user.uid), {
        tasks,
        habitDone,
        projects,
        profile,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch((error: unknown) => setAuthError(error instanceof Error ? error.message : 'Your changes could not be saved.'));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [tasks, habitDone, projects, profile, user, cloudReady]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCapture(true);
      }
      if (event.key === 'Escape') {
        setShowCapture(false);
        setShowMemo(false);
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const completed = tasks.filter((task) => task.done).length;
  const nextTask = tasks.find((task) => !task.done) ?? tasks[0];
  const firstName = profile.name || user?.displayName?.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || 'there';
  const requireAccount = () => {
    if (user) return true;
    setAuthError('Sign in with Google to save your workspace and use it on every device.');
    return false;
  };
  const toggleTask = (id: number) => {
    if (!requireAccount()) return;
    setTasks((items) => items.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  };
  const addTask = (rawTitle: string) => {
    const title = rawTitle.trim();
    if (!title) return;
    if (!requireAccount()) return;
    setTasks((items) => [...items, { id: Date.now(), title, time: 'Unscheduled', duration: '30 min', tag: 'Inbox', color: 'stone' }]);
    setQuickAdd('');
    setShowCapture(false);
  };
  const addProject = (rawTitle: string) => {
    const title = rawTitle.trim();
    if (!title || !requireAccount()) return;
    setProjects((items) => [...items, { id: Date.now(), title, progress: 0 }]);
    if (!profile.features?.includes('projects')) setProfile((current) => ({ ...current, features: [...(current.features ?? []), 'projects'] }));
  };
  const finishSetup = () => {
    const features = setupFeatures.length ? setupFeatures : ['tasks'];
    setProfile({ onboardingCompleted: true, name: setupName.trim() || firstName, focus: setupFocus, features });
    if (setupTask.trim() && !tasks.length) setTasks([{ id: Date.now(), title: setupTask.trim(), time: 'Unscheduled', duration: '30 min', tag: 'First step', color: 'teal' }]);
    if (setupProject.trim() && !projects.length) setProjects([{ id: Date.now() + 1, title: setupProject.trim(), progress: 0 }]);
    setShowSetup(false);
  };
  const switchProvider = (value: Provider) => {
    setProvider(value);
    setModel(providerModels[value]);
  };
  const askMemo = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? memoPrompt).trim();
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    if (!prompt) return;
    setMemoLoading(true);
    setMemoError('');
    setMemoAnswer('');
    try {
      const response = await fetch('/api/memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          apiKey,
          prompt,
          tasks: tasks.map(({ title, time, duration, done, tag }) => ({ title, time, duration, done: Boolean(done), tag })),
        }),
      });
      const data = await response.json() as { answer?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Memo could not reach that provider.');
      setMemoAnswer(data.answer || 'Memo did not return an answer.');
    } catch (error) {
      setMemoError(error instanceof Error ? error.message : 'Memo could not reach that provider.');
    } finally {
      setMemoLoading(false);
    }
  };
  const handleQuickAdd = (event: FormEvent) => {
    event.preventDefault();
    addTask(quickAdd);
  };
  const signIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google sign-in did not complete.');
    } finally {
      setAuthLoading(false);
    }
  };
  const signOutOfManageMe = async () => {
    await signOut(auth);
    setShowMemo(false);
  };

  return (
    <main className="min-h-screen bg-[#f6f5f1] text-stone-900">
      <header className="sticky top-0 z-20 flex h-[65px] items-center justify-between border-b border-stone-200/80 bg-[#fbfaf7]/90 px-4 backdrop-blur md:px-7">
        <div className="flex items-center gap-3">
          <button className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></button>
          <div className="grid size-8 place-items-center rounded-[11px] bg-teal-700 text-sm font-bold text-white shadow-sm">m</div>
          <span className="font-display text-[17px] font-semibold tracking-[-0.04em]">ManageMe</span>
        </div>
        <button onClick={() => setShowCapture(true)} className="hidden w-[min(33vw,390px)] items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-[12px] text-stone-400 shadow-sm transition hover:border-stone-300 md:flex">
          <Search className="size-3.5" /><span className="flex-1">Capture a task, thought, or reminder...</span><kbd className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-400">⌘ K</kbd>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowMemo(true)} className="hidden items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 sm:flex"><Sparkles className="size-3.5" /> Ask Memo</button>
          <button onClick={() => setShowSetup(true)} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100" aria-label="Workspace settings"><Settings2 className="size-4" /></button>
          {user ? <><span className="hidden max-w-28 truncate text-[11px] font-semibold text-stone-600 md:block">{user.displayName?.split(' ')[0] || user.email}</span><button onClick={signOutOfManageMe} className="grid size-8 place-items-center rounded-full bg-orange-100 text-xs font-bold text-orange-700" aria-label="Sign out of ManageMe"><LogOut className="size-3.5" /></button></> : <Button onClick={signIn} disabled={authLoading} size="sm" className="bg-teal-700 text-[11px] hover:bg-teal-800"><LogIn className="size-3.5" />{authLoading ? 'Opening Google…' : 'Sign in'}</Button>}
        </div>
      </header>

      <div className="mx-auto grid max-w-[1550px] grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)_290px]">
        <aside className="hidden min-h-[calc(100vh-65px)] border-r border-stone-200/80 px-4 py-6 lg:block">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.13em] text-stone-400">Navigate</p>
          <nav className="space-y-1">
            {nav.map(([name, Icon]) => (
              <button key={name} onClick={() => setActiveNav(name)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ${activeNav === name ? 'bg-white text-teal-800 shadow-sm ring-1 ring-stone-200/70' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'}`}>
                <Icon className="size-4" /> {name}{name === 'Inbox' && <span className="ml-auto rounded-full bg-orange-100 px-1.5 text-[10px] font-bold text-orange-700">3</span>}
              </button>
            ))}
          </nav>
          <div className="mt-9 border-t border-stone-200 pt-6">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.13em] text-stone-400">Your north stars</p>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-stone-600 hover:bg-stone-100"><span className="size-2 rounded-full bg-indigo-400" /> DSA mastery</button>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-stone-600 hover:bg-stone-100"><span className="size-2 rounded-full bg-orange-400" /> Career growth</button>
          </div>
          <button onClick={() => setShowCapture(true)} className="mt-8 flex items-center gap-2 px-3 text-xs font-semibold text-teal-700 hover:text-teal-900"><CirclePlus className="size-4" /> Capture</button>
        </aside>

        <section className="min-w-0 px-4 py-7 sm:px-7 lg:px-9 xl:px-12">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-teal-700">Wednesday · September 3</p>
              <h1 className="font-display text-3xl font-semibold tracking-[-0.055em] text-stone-900 sm:text-[34px]">Good morning, {firstName}.</h1>
              <p className="mt-1 text-[13px] text-stone-500">A realistic day: <span className="font-semibold text-stone-700">3 priorities</span>, 3h 35m of focused work, 45m protected buffer.</p>
            </div>
            <button onClick={() => setShowMemo(true)} className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 shadow-sm hover:bg-violet-100"><Sparkles className="size-3.5" /> Ask Memo</button>
          </div>

          {!user && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3"><div><p className="text-[12px] font-bold text-orange-950">Make your workspace yours.</p><p className="mt-0.5 text-[11px] text-orange-800/80">Sign in with Google to save tasks, habits, and plans securely across devices.</p></div><Button onClick={signIn} disabled={authLoading} size="sm" className="bg-teal-700 hover:bg-teal-800"><LogIn className="size-3.5" /> Sign in with Google</Button></div>}
          {user && <p className="mb-5 flex items-center gap-1.5 text-[11px] font-semibold text-teal-700"><Cloud className="size-3.5" /> {cloudReady ? 'Saved securely to your Google account' : 'Loading your workspace…'}</p>}
          {authError && <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[11px] text-rose-700"><span>{authError}</span><button onClick={() => setAuthError('')} aria-label="Dismiss message"><X className="size-3.5" /></button></div>}

          {activeNav === 'Today' ? <><div className="mb-5 rounded-2xl border border-teal-100 bg-[#eff8f6] p-4 sm:flex sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-teal-700 text-white"><Target className="size-4" /></div>
              <div><p className="text-[12px] font-bold text-teal-950">Right now: protect the first 90 minutes.</p><p className="mt-0.5 text-[12px] text-teal-800/75">Your hardest work is scheduled before the 10:45 standup — a good match for your energy pattern.</p></div>
            </div>
            <button onClick={() => nextTask && toggleTask(nextTask.id)} className="mt-3 flex shrink-0 items-center gap-1.5 text-xs font-bold text-teal-800 hover:text-teal-950 sm:mt-0">Start focus <ChevronRight className="size-3.5" /></button>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(25,30,25,0.03)] sm:p-5">
              <div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold tracking-[-0.035em]">Today&apos;s plan</h2><p className="text-[11px] text-stone-400">Your work has a home in time — not just a list.</p></div><button className="grid size-7 place-items-center rounded-lg text-stone-400 hover:bg-stone-100" aria-label="More plan options"><MoreHorizontal className="size-4" /></button></div>
              <div className="mb-3 flex gap-2 overflow-x-auto border-b border-stone-100 pb-3"><button className="rounded-md bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-700">All {tasks.length}</button><button className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-stone-400 hover:bg-stone-50">Focus 2</button><button className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-stone-400 hover:bg-stone-50">Later 2</button></div>
              <div className="divide-y divide-stone-100">{tasks.map((task) => <TaskRow key={task.id} task={task} onToggle={toggleTask} />)}</div>
              <form onSubmit={handleQuickAdd} className="mt-3 flex gap-2 border-t border-stone-100 pt-3"><Plus className="mt-2 size-4 text-teal-700" /><Input value={quickAdd} onChange={(event) => setQuickAdd(event.target.value)} placeholder="Add to today..." className="border-0 px-0 shadow-none focus-visible:ring-0" /><Button type="submit" size="sm" variant="ghost" className="text-teal-700">Add</Button></form>
            </div>
            <div className="space-y-5">
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(25,30,25,0.03)]">
                <div className="flex items-center justify-between"><h2 className="font-display text-base font-semibold tracking-[-0.03em]">Daily capacity</h2><span className="text-[10px] font-bold text-orange-600">healthy</span></div>
                <div className="mt-4 flex items-end gap-1.5">{[46, 68, 34, 82, 55, 20, 15].map((height, index) => <div key={height} className="flex-1"><div className={`rounded-t-sm ${index === 3 ? 'bg-teal-600' : 'bg-stone-200'}`} style={{ height: `${height}px` }} /><p className="mt-1 text-center text-[8px] text-stone-400">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</p></div>)}</div>
                <div className="mt-3 flex items-center justify-between text-[11px]"><span className="text-stone-500">Free focus time</span><span className="font-bold text-stone-800">45 min buffer</span></div>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(25,30,25,0.03)]">
                <div className="flex items-center justify-between"><div><h2 className="font-display text-base font-semibold tracking-[-0.03em]">Micro commitment</h2><p className="mt-0.5 text-[10px] text-stone-400">Small enough to repeat.</p></div><button onClick={() => { if (requireAccount()) setHabitDone(!habitDone); }} className={`grid size-7 place-items-center rounded-full ${habitDone ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-400 hover:bg-teal-50 hover:text-teal-700'}`} aria-label="Toggle micro commitment"><Check className="size-3.5" /></button></div>
                <p className={`mt-4 text-[12px] font-semibold ${habitDone ? 'text-teal-700 line-through' : 'text-stone-700'}`}>No phone until I&apos;m ready for office</p>
                <div className="mt-4 flex items-center justify-between">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <div key={`${day}-${index}`}><div className={`grid size-5 place-items-center rounded-full text-[9px] font-bold ${index < 2 || (index === 2 && habitDone) ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-400'}`}>{index < 2 || (index === 2 && habitDone) ? <Check className="size-3" /> : day}</div></div>)}</div>
                <p className="mt-3 text-[10px] text-stone-400">2-day rhythm · consistency, not streak pressure</p>
              </div>
            </div>
          </div>

          {(!profile.onboardingCompleted || profile.features?.includes('projects')) && <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(25,30,25,0.03)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600">3-month direction</p><h2 className="mt-1 font-display text-lg font-semibold tracking-[-0.035em]">Become interview-ready in DSA</h2></div><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700">8 weeks left</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">{[['Foundation', 74], ['Patterns', 32], ['Mock interviews', 0]].map(([label, amount]) => <div key={label as string}><div className="mb-1.5 flex justify-between text-[10px] text-stone-500"><span>{label}</span><span>{amount}%</span></div><Progress value={amount as number} className="[&_[data-slot=progress-indicator]]:bg-indigo-500" /></div>)}</div>
            <p className="mt-4 text-[11px] text-stone-500"><span className="font-semibold text-stone-700">This week:</span> 3 of 5 focused sessions are protected in your calendar.</p>
          </div>}</> : <NavigationPanel activeNav={activeNav} tasks={tasks} projects={projects} onAddProject={addProject} />}
        </section>

        <aside className="border-l border-stone-200/80 bg-[#f9f8f5] px-5 py-7 lg:px-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-stone-400">Your day</p><h2 className="font-display text-lg font-semibold tracking-[-0.035em]">On the calendar</h2></div><CalendarDays className="size-4 text-stone-400" /></div>
          <div className="relative border-l border-stone-200 pl-4">
            <div className="absolute -left-[3px] top-[21px] size-1.5 rounded-full bg-teal-600" /><p className="text-[10px] font-bold text-teal-700">NOW · 9:12 AM</p>
            <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3"><p className="text-[12px] font-bold text-indigo-950">DSA deep work</p><p className="mt-1 text-[10px] text-indigo-700">9:00 – 10:30 · Focus</p></div>
            {[['10:45 AM', 'Engineering standup', '25 min · Google Calendar'], ['11:00 AM', 'Project brief review', '45 min · Work'], ['2:00 PM', 'Client sync', '60 min · Google Calendar']].map(([time, title, detail]) => <div key={title} className="mt-5 border-t border-dashed border-stone-200 pt-4"><p className="text-[10px] font-bold text-stone-400">{time}</p><p className="mt-1 text-[12px] font-semibold text-stone-700">{title}</p><p className="text-[10px] text-stone-400">{detail}</p></div>)}
          </div>
          <div className="mt-8 rounded-xl border border-violet-100 bg-violet-50 p-3.5"><div className="flex items-center gap-2 text-violet-800"><Lightbulb className="size-4" /><p className="text-[11px] font-bold">Memo&apos;s quiet observation</p></div><p className="mt-2 text-[11px] leading-relaxed text-violet-800/80">Your 4:00 PM task is flexible. Keep it unscheduled until after the client call.</p><button onClick={() => { setMemoPrompt('Why is my afternoon overloaded, and what can I safely postpone?'); setShowMemo(true); }} className="mt-3 flex items-center gap-1 text-[11px] font-bold text-violet-700 hover:text-violet-900">Ask Memo why <ArrowUpRight className="size-3" /></button></div>
        </aside>
      </div>

      {showSetup && <div className="fixed inset-0 z-[70] overflow-y-auto bg-stone-950/35 p-4 backdrop-blur-sm"><div className="mx-auto my-5 w-full max-w-2xl rounded-3xl border border-stone-200 bg-[#fbfaf7] p-6 shadow-2xl sm:my-10 sm:p-8"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700">Your calm starting point</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]">Set up the space you need now.</h2><p className="mt-2 text-sm leading-relaxed text-stone-500">Answer a few quick questions. Every other feature stays in Settings until you want it.</p></div>{profile.onboardingCompleted && <button onClick={() => setShowSetup(false)} aria-label="Close workspace setup"><X className="size-4 text-stone-400" /></button>}</div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-[11px] font-bold text-stone-600">What should we call you?<Input autoFocus value={setupName} onChange={(event) => setSetupName(event.target.value)} placeholder="Your first name" className="mt-1.5 bg-white" /></label><label className="text-[11px] font-bold text-stone-600">What are you using ManageMe for?<select value={setupFocus} onChange={(event) => { const focus = event.target.value; setSetupFocus(focus); setSetupFeatures(focus === 'Work' ? ['tasks', 'projects', 'planner'] : focus === 'Study' ? ['tasks', 'habit', 'projects'] : ['tasks', 'habit']); }} className="mt-1.5 h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal outline-none focus:border-teal-400"><option>Personal life</option><option>Work</option><option>Study</option></select></label></div><div className="mt-6"><p className="text-[11px] font-bold text-stone-600">What should appear first?</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{(['tasks', 'habit', 'projects', 'planner'] as Feature[]).map((feature) => { const labels: Record<Feature, [string, string]> = { tasks: ['Today’s tasks', 'A short useful list'], habit: ['Habit rhythm', 'One small commitment'], projects: ['Projects', 'Longer goals without clutter'], planner: ['Simple planner', 'Give tasks a place in time'] }; const selected = setupFeatures.includes(feature); return <button key={feature} onClick={() => setSetupFeatures((items) => selected ? items.filter((item) => item !== feature) : [...items, feature])} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selected ? 'border-teal-400 bg-teal-50' : 'border-stone-200 bg-white'}`}><span className={`grid size-5 place-items-center rounded-full border ${selected ? 'border-teal-600 bg-teal-600 text-white' : 'border-stone-300 text-transparent'}`}><Check className="size-3" /></span><span><span className="block text-xs font-bold text-stone-800">{labels[feature][0]}</span><span className="block text-[10px] text-stone-500">{labels[feature][1]}</span></span></button>; })}</div></div><div className="mt-6"><p className="text-[11px] font-bold text-stone-600">Optional: give yourself one helpful starting point</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><Input value={setupTask} onChange={(event) => setSetupTask(event.target.value)} placeholder="First task" /><Input value={setupHabit} onChange={(event) => setSetupHabit(event.target.value)} placeholder="Small habit" /><Input value={setupProject} onChange={(event) => setSetupProject(event.target.value)} placeholder="First project" /></div></div><div className="mt-7 flex justify-end"><Button onClick={finishSetup} className="bg-teal-700 hover:bg-teal-800">Create my layout <ArrowUpRight className="size-3.5" /></Button></div></div></div>}
      {showCapture && <div className="fixed inset-0 z-50 grid place-items-start bg-stone-900/15 px-4 pt-[12vh] backdrop-blur-sm"><div className="w-full max-w-xl rounded-2xl border border-stone-200 bg-white p-3 shadow-2xl"><div className="flex items-center gap-3 border-b border-stone-100 px-2 pb-3"><Command className="size-4 text-teal-700" /><Input autoFocus value={quickAdd} onChange={(event) => setQuickAdd(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addTask(quickAdd)} placeholder="What do you want to remember?" className="h-9 border-0 px-0 text-base shadow-none focus-visible:ring-0" /><button onClick={() => setShowCapture(false)} aria-label="Close capture"><X className="size-4 text-stone-400" /></button></div><div className="flex items-center justify-between px-2 pt-3"><p className="text-[11px] text-stone-400">Capture first. Organize later.</p><Button onClick={() => addTask(quickAdd)} size="sm" className="bg-teal-700 hover:bg-teal-800">Add to inbox</Button></div></div></div>}

      {showMemo && <div className="fixed inset-0 z-50 grid place-items-center bg-stone-900/20 px-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-2xl border border-violet-100 bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div className="flex gap-3"><div className="grid size-9 place-items-center rounded-xl bg-violet-600 text-white"><Sparkles className="size-4" /></div><div><h2 className="font-display text-lg font-semibold tracking-[-0.04em]">Memo · your planning assistant</h2><p className="text-[11px] text-stone-400">Uses your own {provider === 'grok' ? 'Grok' : provider === 'openai' ? 'OpenAI' : 'Claude'} key for this session.</p></div></div><button onClick={() => setShowMemo(false)} aria-label="Close Memo"><X className="size-4 text-stone-400" /></button></div>{!apiKey ? <div className="mt-5 rounded-xl bg-violet-50 p-4"><p className="text-[13px] font-semibold text-violet-950">Connect Memo first.</p><p className="mt-1 text-[12px] leading-relaxed text-violet-800/80">Your key stays only in this browser session and is used to answer your request.</p><Button onClick={() => setShowSettings(true)} size="sm" className="mt-3 bg-violet-600 hover:bg-violet-700"><KeyRound className="size-3.5" /> Connect a provider</Button></div> : <><div className="mt-5 flex gap-2"><button onClick={() => askMemo('Plan tomorrow for me.')} className="rounded-xl border border-violet-100 bg-violet-50 p-2.5 text-left text-[11px] font-semibold text-violet-800 hover:bg-violet-100">Plan tomorrow</button><button onClick={() => askMemo('What can I safely postpone?')} className="rounded-xl border border-violet-100 bg-violet-50 p-2.5 text-left text-[11px] font-semibold text-violet-800 hover:bg-violet-100">What can I postpone?</button></div><textarea value={memoPrompt} onChange={(event) => setMemoPrompt(event.target.value)} placeholder="Ask Memo about your plan..." className="mt-4 min-h-24 w-full resize-none rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" /><div className="mt-3 flex justify-end"><Button onClick={() => askMemo()} disabled={memoLoading || !memoPrompt.trim()} size="sm" className="bg-violet-600 hover:bg-violet-700">{memoLoading ? 'Thinking…' : <><Send className="size-3.5" /> Ask Memo</>}</Button></div>{memoError && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{memoError}</p>}{memoAnswer && <div className="mt-4 rounded-xl bg-[#f8f7ff] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-600">Memo&apos;s proposal</p><p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-violet-950">{memoAnswer}</p></div>}</>}</div></div>}

      {showSettings && <div className="fixed inset-0 z-[60] grid place-items-center bg-stone-900/25 px-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="font-display text-lg font-semibold tracking-[-0.04em]">Connect Memo</h2><p className="mt-1 text-[11px] text-stone-400">Bring your own provider key. It is never saved to your account.</p></div><button onClick={() => setShowSettings(false)} aria-label="Close Memo settings"><X className="size-4 text-stone-400" /></button></div><label className="mt-5 block text-[11px] font-bold text-stone-600">Provider<select value={provider} onChange={(event) => switchProvider(event.target.value as Provider)} className="mt-1.5 h-9 w-full rounded-lg border border-stone-200 bg-white px-2.5 text-sm font-normal outline-none focus:border-violet-300"><option value="grok">Grok / xAI</option><option value="openai">OpenAI</option><option value="claude">Claude / Anthropic</option></select></label><label className="mt-4 block text-[11px] font-bold text-stone-600">Model<Input value={model} onChange={(event) => setModel(event.target.value)} className="mt-1.5" /></label><label className="mt-4 block text-[11px] font-bold text-stone-600">API key<Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste your key for this browser session" className="mt-1.5" /></label><div className="mt-4 rounded-lg bg-stone-50 p-3 text-[11px] leading-relaxed text-stone-500"><KeyRound className="mr-1 inline size-3.5 text-teal-700" /> Memo keeps your key in session storage only. It is cleared when you close this browser session; it is not committed to Git or stored by ManageMe.</div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setApiKey(''); window.sessionStorage.removeItem('memo-api-key'); }}>Forget key</Button><Button size="sm" onClick={() => { setShowSettings(false); setShowMemo(true); }} className="bg-violet-600 hover:bg-violet-700">Save for this session</Button></div></div></div>}
    </main>
  );
}
