'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import {
  ArrowUpRight,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlus,
  BookOpen,
  CircleAlert,
  Cloud,
  Command,
  Dumbbell,
  FolderKanban,
  ImagePlus,
  Inbox,
  KeyRound,
  Lightbulb,
  Link2,
  LogIn,
  LogOut,
  Menu,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Target,
  TimerReset,
  WifiOff,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { PandaCompanion } from '@/components/panda-companion';
import { auth, db, firebaseApp, googleProvider } from '@/lib/firebase';

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
type BoardStatus = 'Backlog' | 'Next' | 'Doing' | 'Done';
type Attachment = {
  id: number;
  kind: 'link' | 'image';
  name: string;
  url: string;
};
type BoardCard = {
  id: number;
  title: string;
  status: BoardStatus;
  attachments?: Attachment[];
};
type Project = {
  id: number;
  title: string;
  progress: number;
  cards?: BoardCard[];
};
type WorkspaceProfile = {
  onboardingCompleted?: boolean;
  name?: string;
  focus?: string;
  features?: Feature[];
};
type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

const defaults: Task[] = [
  {
    id: 1,
    title: 'DSA: dynamic programming set',
    time: '9:00 AM',
    duration: '90 min',
    tag: 'DSA prep',
    color: 'indigo',
    priority: true,
  },
  {
    id: 2,
    title: 'Review Q4 project brief',
    time: '11:00 AM',
    duration: '45 min',
    tag: 'Work',
    color: 'orange',
    priority: true,
  },
  {
    id: 3,
    title: 'Submit internship applications',
    time: '4:00 PM',
    duration: '60 min',
    tag: 'Career',
    color: 'rose',
  },
  {
    id: 4,
    title: 'Call Mom',
    time: '6:30 PM',
    duration: '20 min',
    tag: 'Personal',
    color: 'emerald',
  },
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

const asDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Image could not be read.'));
    reader.readAsDataURL(file);
  });

function TaskRow({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (id: number) => void;
}) {
  return (
    <div
      className={`group flex items-center gap-3 rounded-xl px-2 py-2.5 transition ${task.done ? 'opacity-45' : 'hover:bg-stone-50'}`}
    >
      <button
        aria-label={`Mark ${task.title} as ${task.done ? 'incomplete' : 'complete'}`}
        onClick={() => onToggle(task.id)}
        className={`grid size-5 shrink-0 place-items-center rounded-full border ${task.done ? 'border-teal-500 bg-teal-500 text-white' : 'border-stone-300 text-transparent hover:border-teal-500'}`}
      >
        <Check className="size-3" strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[13px] font-medium text-stone-800 ${task.done ? 'line-through' : ''}`}
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-[11px] text-stone-400">
          {task.time} · {task.duration}
        </p>
      </div>
      <span
        className={`hidden rounded-md px-2 py-1 text-[10px] font-semibold sm:inline-block tag-${task.color}`}
      >
        {task.tag}
      </span>
      {task.priority && (
        <span
          className="size-1.5 rounded-full bg-orange-400"
          aria-label="Priority task"
        />
      )}
    </div>
  );
}

function NavigationPanel({
  activeNav,
  tasks,
  projects,
  onAddProject,
  onUpdateProject,
  onUploadImage,
}: {
  activeNav: string;
  tasks: Task[];
  projects: Project[];
  onAddProject: (title: string) => void;
  onUpdateProject: (
    projectId: number,
    callback: (project: Project) => Project,
  ) => void;
  onUploadImage: (projectId: number, cardId: number, file: File) => void;
}) {
  const [title, setTitle] = useState('');
  if (activeNav === 'Inbox')
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700">
          Capture first
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Inbox</h2>
        <p className="mt-2 text-sm text-stone-500">
          Your captured tasks stay here until you decide where they belong.
        </p>
        <div className="mt-6 space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-xl bg-stone-50 px-4 py-3 text-sm font-medium text-stone-700"
            >
              {task.title}
            </div>
          ))}
        </div>
      </div>
    );
  if (activeNav === 'Planner')
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700">
          Keep it realistic
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Planner</h2>
        <div className="mt-6 space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-4 rounded-xl bg-stone-50 px-4 py-3"
            >
              <span className="w-24 text-xs font-bold text-teal-700">
                {task.time}
              </span>
              <span className="text-sm font-medium text-stone-700">
                {task.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  if (activeNav === 'Projects')
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600">
          Longer direction
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Projects board
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          A calm, Jira-style place for work that needs context, links, or a
          visual attachment.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onAddProject(title);
            setTitle('');
          }}
          className="mt-6 flex gap-2"
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Name a project or goal"
          />
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
            Add project
          </Button>
        </form>
        <div className="mt-6 space-y-6">
          {projects.length ? (
            projects.map((project) => (
              <ProjectBoard
                key={project.id}
                project={project}
                onUpdate={(callback) => onUpdateProject(project.id, callback)}
                onUploadImage={(cardId, file) =>
                  onUploadImage(project.id, cardId, file)
                }
              />
            ))
          ) : (
            <p className="text-sm text-stone-400">
              No projects yet. Create one to start its board.
            </p>
          )}
        </div>
      </div>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <p className="text-[11px] text-stone-400">Tasks completed</p>
        <p className="mt-2 font-display text-3xl font-semibold">
          {tasks.filter((task) => task.done).length}/{tasks.length}
        </p>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <p className="text-[11px] text-stone-400">Projects</p>
        <p className="mt-2 font-display text-3xl font-semibold">
          {projects.length}
        </p>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <p className="text-[11px] text-stone-400">A gentle reminder</p>
        <p className="mt-2 text-sm font-medium text-stone-700">
          Progress is a pattern, not a score.
        </p>
      </div>
    </div>
  );
}

function ProjectBoard({
  project,
  onUpdate,
  onUploadImage,
}: {
  project: Project;
  onUpdate: (callback: (project: Project) => Project) => void;
  onUploadImage: (cardId: number, file: File) => void;
}) {
  const [cardTitle, setCardTitle] = useState('');
  const [link, setLink] = useState('');
  const addCard = (event: FormEvent) => {
    event.preventDefault();
    const title = cardTitle.trim();
    if (!title) return;
    onUpdate((item) => ({
      ...item,
      cards: [
        ...(item.cards ?? []),
        { id: Date.now(), title, status: 'Backlog', attachments: [] },
      ],
    }));
    setCardTitle('');
  };
  const statuses: BoardStatus[] = ['Backlog', 'Next', 'Doing', 'Done'];
  const cards = project.cards ?? [];
  return (
    <section className="rounded-2xl border border-stone-200 bg-[#fcfcfa] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-stone-900">
            {project.title}
          </h3>
          <p className="mt-0.5 text-[11px] text-stone-400">
            Raise a task, then add a Drive link or image directly on its card.
          </p>
        </div>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
          {cards.length} cards
        </span>
      </div>
      <form onSubmit={addCard} className="mt-4 flex gap-2">
        <Input
          value={cardTitle}
          onChange={(event) => setCardTitle(event.target.value)}
          placeholder="Raise a task for this project"
        />
        <Button
          type="submit"
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="size-3.5" /> Add card
        </Button>
      </form>
      <div className="mt-4 grid gap-3 xl:grid-cols-4">
        {statuses.map((status) => (
          <div
            key={status}
            className="min-h-36 rounded-xl bg-stone-100/80 p-2.5"
          >
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.1em] text-stone-500">
              {status}
            </p>
            <div className="space-y-2">
              {cards
                .filter((card) => card.status === status)
                .map((card) => (
                  <article
                    key={card.id}
                    className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm"
                  >
                    <p className="text-xs font-bold text-stone-800">
                      {card.title}
                    </p>
                    <div className="mt-2 flex gap-1">
                      <select
                        aria-label={`Move ${card.title}`}
                        value={card.status}
                        onChange={(event) =>
                          onUpdate((item) => ({
                            ...item,
                            cards: (item.cards ?? []).map((current) =>
                              current.id === card.id
                                ? {
                                    ...current,
                                    status: event.target.value as BoardStatus,
                                  }
                                : current,
                            ),
                          }))
                        }
                        className="min-w-0 flex-1 rounded border border-stone-200 bg-white px-1 py-1 text-[10px] text-stone-500"
                      >
                        <option>Backlog</option>
                        <option>Next</option>
                        <option>Doing</option>
                        <option>Done</option>
                      </select>
                      <label
                        className="grid size-6 place-items-center rounded border border-stone-200 text-stone-500 hover:bg-stone-50"
                        title="Attach image"
                      >
                        <ImagePlus className="size-3.5" />
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) onUploadImage(card.id, file);
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <Input
                        value={link}
                        onChange={(event) => setLink(event.target.value)}
                        placeholder="Paste Drive link"
                        className="h-7 min-w-0 px-2 text-[10px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = link.trim();
                          if (!url) return;
                          onUpdate((item) => ({
                            ...item,
                            cards: (item.cards ?? []).map((current) =>
                              current.id === card.id
                                ? {
                                    ...current,
                                    attachments: [
                                      ...(current.attachments ?? []),
                                      {
                                        id: Date.now(),
                                        kind: 'link',
                                        name: 'Reference link',
                                        url,
                                      },
                                    ],
                                  }
                                : current,
                            ),
                          }));
                          setLink('');
                        }}
                        className="grid size-7 shrink-0 place-items-center rounded bg-stone-100 text-stone-600 hover:bg-stone-200"
                        aria-label="Add link"
                      >
                        <Link2 className="size-3.5" />
                      </button>
                    </div>
                    {card.attachments?.length ? (
                      <div className="mt-2 space-y-1">
                        {card.attachments.map((attachment) => (
                          <div key={attachment.id}>
                            {attachment.kind === 'image' &&
                            attachment.url.startsWith('data:') ? (
                              <img
                                src={attachment.url}
                                alt={attachment.name}
                                className="mb-1 h-16 w-full rounded-md border border-stone-100 object-cover"
                              />
                            ) : null}
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 truncate text-[10px] font-semibold text-indigo-600 hover:underline"
                            >
                              {attachment.kind === 'image' ? (
                                <ImagePlus className="size-3" />
                              ) : (
                                <Link2 className="size-3" />
                              )}
                              {attachment.name}
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(defaults);
  const [activeNav, setActiveNav] = useState('Today');
  const [quickAdd, setQuickAdd] = useState('');
  const [habitDone, setHabitDone] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState<Provider>('grok');
  const [model, setModel] = useState(providerModels.grok);
  const [apiKey, setApiKey] = useState('');
  const [memoAnswer, setMemoAnswer] = useState('');
  const [memoError, setMemoError] = useState('');
  const [memoLoading, setMemoLoading] = useState(false);
  const memoRequestInFlight = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncError, setSyncError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<WorkspaceProfile>({});
  const [showSetup, setShowSetup] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupFocus, setSetupFocus] = useState('Personal life');
  const [setupFeatures, setSetupFeatures] = useState<Feature[]>([
    'tasks',
    'habit',
  ]);
  const [setupTask, setSetupTask] = useState('');
  const [setupHabit, setSetupHabit] = useState('');
  const [setupProject, setSetupProject] = useState('');
  const [showFocus, setShowFocus] = useState(false);
  const [focusTask, setFocusTask] = useState('');
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [focusRemaining, setFocusRemaining] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusQuote, setFocusQuote] = useState(0);
  const [pandaOpen, setPandaOpen] = useState(false);
  const [helpPrompt, setHelpPrompt] = useState('');

  useEffect(() => {
    const savedProvider = window.sessionStorage.getItem(
      'memo-provider',
    ) as Provider | null;
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
        setAuthChecked(true);
        return;
      }

      try {
        const workspace = doc(db, 'users', nextUser.uid);
        const snapshot = await getDoc(workspace);
        if (!active) return;
        if (snapshot.exists()) {
          const saved = snapshot.data() as {
            tasks?: Task[];
            habitDone?: boolean;
            projects?: Project[];
            profile?: WorkspaceProfile;
          };
          if (Array.isArray(saved.tasks)) setTasks(saved.tasks);
          setHabitDone(Boolean(saved.habitDone));
          if (Array.isArray(saved.projects)) setProjects(saved.projects);
          const loadedProfile = saved.profile ?? {};
          setProfile(loadedProfile);
          setSetupName(
            loadedProfile.name || nextUser.displayName?.split(' ')[0] || '',
          );
          setSetupFocus(loadedProfile.focus || 'Personal life');
          setSetupFeatures(
            loadedProfile.features?.length
              ? loadedProfile.features
              : ['tasks', 'habit'],
          );
          if (!loadedProfile.onboardingCompleted) setShowSetup(true);
        } else {
          // Bring any existing device-only data into the new account once.
          const legacyTasks = window.localStorage.getItem('manageme-tasks');
          const legacyHabit =
            window.localStorage.getItem('manageme-habit') === 'true';
          const initialTasks = legacyTasks
            ? (JSON.parse(legacyTasks) as Task[])
            : defaults;
          setTasks(initialTasks);
          setHabitDone(legacyHabit);
          await setDoc(workspace, {
            tasks: initialTasks,
            habitDone: legacyHabit,
            projects: [],
            profile: {
              name: nextUser.displayName ?? '',
              email: nextUser.email ?? '',
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          window.localStorage.removeItem('manageme-tasks');
          window.localStorage.removeItem('manageme-habit');
          setSetupName(nextUser.displayName?.split(' ')[0] || '');
          setShowSetup(true);
        }
        if (active) {
          setCloudReady(true);
          setSyncState('saved');
        }
      } catch (error) {
        if (active) {
          setSyncState('error');
          setSyncError(
            'We could not load your cloud workspace. Your next changes will be kept on this device until you retry.',
          );
          setAuthError(
            error instanceof Error
              ? error.message
              : 'Your workspace could not be loaded.',
          );
        }
      } finally {
        if (active) setAuthChecked(true);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!user || !cloudReady) return;
    const timeout = window.setTimeout(async () => {
      const backupKey = `manageme-pending-${user.uid}`;
      const workspaceData = {
        tasks,
        habitDone,
        projects,
        profile,
      };
      if (!navigator.onLine) {
        window.localStorage.setItem(backupKey, JSON.stringify(workspaceData));
        setSyncState('offline');
        return;
      }
      setSyncState('saving');
      try {
        await setDoc(
          doc(db, 'users', user.uid),
          { ...workspaceData, updatedAt: serverTimestamp() },
          { merge: true },
        );
        window.localStorage.removeItem(backupKey);
        setSyncError('');
        setSyncState('saved');
      } catch {
        window.localStorage.setItem(backupKey, JSON.stringify(workspaceData));
        setSyncState('error');
        setSyncError(
          'Couldn’t save just now. Your changes are safely kept on this device. Retry when you are online.',
        );
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [tasks, habitDone, projects, profile, user, cloudReady]);
  useEffect(() => {
    const goOnline = () => setSyncState('idle');
    const goOffline = () => setSyncState('offline');
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  useEffect(() => {
    if (!focusRunning) return;
    const timer = window.setInterval(
      () =>
        setFocusRemaining((remaining) => {
          if (remaining <= 1) {
            window.clearInterval(timer);
            setFocusRunning(false);
            return 0;
          }
          return remaining - 1;
        }),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [focusRunning]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCapture(true);
      }
      if (event.key === 'Escape') {
        setShowCapture(false);
        setShowSettings(false);
        setPandaOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (showSetup || showCapture || showFocus || showSettings) {
      setPandaOpen(false);
    }
  }, [showSetup, showCapture, showFocus, showSettings]);

  const nextTask = tasks.find((task) => !task.done) ?? tasks[0];
  const firstName =
    profile.name ||
    user?.displayName?.trim().split(/\s+/)[0] ||
    user?.email?.split('@')[0] ||
    'there';
  const requireAccount = () => {
    if (user) return true;
    setAuthError(
      'Sign in with Google to save your workspace and use it on every device.',
    );
    return false;
  };
  const toggleTask = (id: number) => {
    if (!requireAccount()) return;
    setTasks((items) =>
      items.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );
  };
  const addTask = (rawTitle: string) => {
    const title = rawTitle.trim();
    if (!title) return;
    if (!requireAccount()) return;
    setTasks((items) => [
      ...items,
      {
        id: Date.now(),
        title,
        time: 'Unscheduled',
        duration: '30 min',
        tag: 'Inbox',
        color: 'stone',
      },
    ]);
    setQuickAdd('');
    setShowCapture(false);
  };
  const addProject = (rawTitle: string) => {
    const title = rawTitle.trim();
    if (!title || !requireAccount()) return;
    setProjects((items) => [...items, { id: Date.now(), title, progress: 0 }]);
    if (!profile.features?.includes('projects'))
      setProfile((current) => ({
        ...current,
        features: [...(current.features ?? []), 'projects'],
      }));
  };
  const updateProject = (
    projectId: number,
    callback: (project: Project) => Project,
  ) => {
    if (!requireAccount()) return;
    setProjects((items) =>
      items.map((project) =>
        project.id === projectId ? callback(project) : project,
      ),
    );
  };
  const uploadAttachment = async (
    projectId: number,
    cardId: number,
    file: File,
  ) => {
    if (!requireAccount()) return;
    if (!file.type.startsWith('image/')) {
      setSyncError('Please attach a PNG, JPEG, or WebP image.');
      setSyncState('error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSyncError('Images are limited to 5 MB so your board stays fast.');
      setSyncState('error');
      return;
    }
    try {
      setSyncState('saving');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const fileRef = ref(
        getStorage(firebaseApp),
        `users/${user!.uid}/attachments/${Date.now()}-${safeName}`,
      );
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      updateProject(projectId, (project) => ({
        ...project,
        cards: (project.cards ?? []).map((card) =>
          card.id === cardId
            ? {
                ...card,
                attachments: [
                  ...(card.attachments ?? []),
                  { id: Date.now(), kind: 'image', name: file.name, url },
                ],
              }
            : card,
        ),
      }));
      setSyncState('saved');
    } catch {
      // A small inline image keeps attachments usable even before Firebase Storage is enabled.
      if (file.size <= 220 * 1024) {
        try {
          const url = await asDataUrl(file);
          updateProject(projectId, (project) => ({
            ...project,
            cards: (project.cards ?? []).map((card) =>
              card.id === cardId
                ? {
                    ...card,
                    attachments: [
                      ...(card.attachments ?? []),
                      { id: Date.now(), kind: 'image', name: file.name, url },
                    ],
                  }
                : card,
            ),
          }));
          setSyncState('saved');
          setSyncError(
            'Image storage is not connected yet, so this small image was safely added to the project itself. Enable Firebase Storage later for larger files.',
          );
          return;
        } catch {
          /* fall through to the user-facing recovery message */
        }
      }
      setSyncState('error');
      setSyncError(
        'The image could not be attached. Check your connection, then retry — or use a smaller image (under 220 KB) until cloud attachment storage is enabled.',
      );
    }
  };
  const retrySync = async () => {
    if (!user) return;
    setSyncState('saving');
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { tasks, habitDone, projects, profile, updatedAt: serverTimestamp() },
        { merge: true },
      );
      window.localStorage.removeItem(`manageme-pending-${user.uid}`);
      setSyncError('');
      setSyncState('saved');
    } catch {
      setSyncState(navigator.onLine ? 'error' : 'offline');
      setSyncError(
        'Still unable to reach your workspace. Your changes remain on this device.',
      );
    }
  };
  const startFocus = () => {
    const task =
      focusTask.trim() || nextTask?.title || 'Your next important task';
    setFocusTask(task);
    setFocusRemaining(focusMinutes * 60);
    setFocusRunning(true);
    setShowFocus(true);
  };
  const finishSetup = () => {
    const features = setupFeatures.length ? setupFeatures : ['tasks'];
    setProfile({
      onboardingCompleted: true,
      name: setupName.trim() || firstName,
      focus: setupFocus,
      features,
    });
    if (setupTask.trim() && !tasks.length)
      setTasks([
        {
          id: Date.now(),
          title: setupTask.trim(),
          time: 'Unscheduled',
          duration: '30 min',
          tag: 'First step',
          color: 'teal',
        },
      ]);
    if (setupProject.trim() && !projects.length)
      setProjects([
        { id: Date.now() + 1, title: setupProject.trim(), progress: 0 },
      ]);
    setShowSetup(false);
  };
  const switchProvider = (value: Provider) => {
    setProvider(value);
    setModel(providerModels[value]);
  };
  const askMemo = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? '').trim();
    if (!apiKey) {
      setShowSettings(true);
      return;
    }
    if (!prompt || memoRequestInFlight.current) return;
    memoRequestInFlight.current = true;
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
          tasks: tasks.map(({ title, time, duration, done, tag }) => ({
            title,
            time,
            duration,
            done: Boolean(done),
            tag,
          })),
        }),
      });
      const data = (await response.json()) as {
        answer?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || 'Memo could not reach that provider.');
      setMemoAnswer(data.answer || 'Memo did not return an answer.');
    } catch (error) {
      setMemoError(
        error instanceof Error
          ? error.message
          : 'Memo could not reach that provider.',
      );
    } finally {
      memoRequestInFlight.current = false;
      setMemoLoading(false);
    }
  };
  const askPanda = (prompt: string) => {
    if (memoRequestInFlight.current) return;
    setMemoAnswer('');
    setMemoError('');
    if (apiKey) {
      void askMemo(prompt);
      return;
    }
    memoRequestInFlight.current = true;
    setMemoLoading(true);
    window.setTimeout(() => {
      setMemoAnswer(
        'I can guide you without an AI key: use Today for your short list, Projects for board cards with Drive links or images, and Focus to protect one task at a time. Connect Grok, OpenAI, or Claude whenever you want personal planning help.',
      );
      memoRequestInFlight.current = false;
      setMemoLoading(false);
    }, 720);
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
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Google sign-in did not complete.',
      );
    } finally {
      setAuthLoading(false);
    }
  };
  const signOutOfManageMe = async () => {
    await signOut(auth);
  };

  if (!authChecked)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f5f1] text-sm font-semibold text-teal-800">
        Preparing your calm space…
      </main>
    );
  if (!user)
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#f6f5f1] text-stone-900">
        <div className="absolute -left-24 top-24 size-72 rounded-full bg-teal-100/60 blur-3xl" />
        <div className="absolute -right-24 bottom-4 size-80 rounded-full bg-rose-100/70 blur-3xl" />
        <header className="relative z-10 mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-[11px] bg-teal-700 text-sm font-bold text-white">
              m
            </div>
            <span className="font-display text-lg font-semibold">ManageMe</span>
          </div>
          <Button
            onClick={signIn}
            disabled={authLoading}
            className="bg-teal-700 hover:bg-teal-800"
          >
            <LogIn className="size-4" />
            {authLoading ? 'Opening Google…' : 'Start with Google'}
          </Button>
        </header>
        <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-5 pb-20 pt-12 md:grid-cols-[1.05fr_.95fr] md:pt-24">
          <div>
            <p className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-bold tracking-wide text-teal-800">
              YOUR CALMER WAY FORWARD
            </p>
            <h1 className="mt-5 max-w-xl font-display text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-[3.5rem]">
              The missing link between today and your next goal.{' '}
              <span className="inline-block text-[0.78em] align-[0.05em]">
                😉
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-stone-600">
              A personal space for small habits, realistic plans, focused work,
              and projects that grow with you — without making your day feel
              like a system to manage.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                onClick={signIn}
                disabled={authLoading}
                size="lg"
                className="bg-teal-700 hover:bg-teal-800"
              >
                Build my calm workspace <ArrowUpRight className="size-4" />
              </Button>
              <span className="self-center text-xs font-semibold text-stone-500">
                Free to begin · Google sign-in keeps it private
              </span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md rounded-[2.5rem] border border-white/80 bg-white/70 p-5 shadow-[0_24px_70px_rgba(26,75,70,.12)] backdrop-blur">
            <div className="rounded-[2rem] bg-[#fdf6f2] px-6 pb-4 pt-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-500">
                Your gentle co-pilot
              </p>
              <p className="mt-2 font-display text-2xl font-semibold">
                A little less noise. A lot more momentum.
              </p>
              <img
                src="/panda/awake-small.png"
                alt="Awake ManageMe Panda waving hello"
                width={404}
                height={420}
                className="mx-auto mt-3 h-52 w-auto max-w-full object-contain drop-shadow-xl sm:h-56 lg:h-60"
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-stone-600">
              <span className="rounded-xl bg-teal-50 px-2 py-3">
                Habit rhythm
              </span>
              <span className="rounded-xl bg-indigo-50 px-2 py-3">
                Focus sessions
              </span>
              <span className="rounded-xl bg-rose-50 px-2 py-3">
                Projects board
              </span>
            </div>
          </div>
        </section>
        {authError && (
          <p className="relative z-10 mx-auto mb-8 max-w-2xl rounded-xl bg-rose-50 p-3 text-center text-xs text-rose-700">
            {authError}
          </p>
        )}
      </main>
    );

  return (
    <main className="min-h-screen bg-[#f6f5f1] text-stone-900">
      <header className="sticky top-0 z-20 flex h-[65px] items-center justify-between border-b border-stone-200/80 bg-[#fbfaf7]/90 px-4 backdrop-blur md:px-7">
        <div className="flex items-center gap-3">
          <button
            className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <div className="grid size-8 place-items-center rounded-[11px] bg-teal-700 text-sm font-bold text-white shadow-sm">
            m
          </div>
          <span className="font-display text-[17px] font-semibold tracking-[-0.04em]">
            ManageMe
          </span>
        </div>
        <button
          onClick={() => setShowCapture(true)}
          className="hidden w-[min(33vw,390px)] items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-[12px] text-stone-400 shadow-sm transition hover:border-stone-300 md:flex"
        >
          <Search className="size-3.5" />
          <span className="flex-1">
            Capture a task, thought, or reminder...
          </span>
          <kbd className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-400">
            ⌘ K
          </kbd>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFocusTask(nextTask?.title || '');
              setShowFocus(true);
            }}
            className="hidden items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 sm:flex"
          >
            <TimerReset className="size-3.5" /> Focus
          </button>
          <button
            onClick={() => setShowSetup(true)}
            className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
            aria-label="Workspace settings"
          >
            <Settings2 className="size-4" />
          </button>
          {user ? (
            <>
              <span className="hidden max-w-28 truncate text-[11px] font-semibold text-stone-600 md:block">
                {user.displayName?.split(' ')[0] || user.email}
              </span>
              <button
                onClick={signOutOfManageMe}
                className="grid size-8 place-items-center rounded-full bg-orange-100 text-xs font-bold text-orange-700"
                aria-label="Sign out of ManageMe"
              >
                <LogOut className="size-3.5" />
              </button>
            </>
          ) : (
            <Button
              onClick={signIn}
              disabled={authLoading}
              size="sm"
              className="bg-teal-700 text-[11px] hover:bg-teal-800"
            >
              <LogIn className="size-3.5" />
              {authLoading ? 'Opening Google…' : 'Sign in'}
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-[1550px] grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)_290px]">
        <aside className="hidden min-h-[calc(100vh-65px)] border-r border-stone-200/80 px-4 py-6 lg:block">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.13em] text-stone-400">
            Navigate
          </p>
          <nav className="space-y-1">
            {nav.map(([name, Icon]) => (
              <button
                key={name}
                onClick={() => setActiveNav(name)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ${activeNav === name ? 'bg-white text-teal-800 shadow-sm ring-1 ring-stone-200/70' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'}`}
              >
                <Icon className="size-4" /> {name}
                {name === 'Inbox' && (
                  <span className="ml-auto rounded-full bg-orange-100 px-1.5 text-[10px] font-bold text-orange-700">
                    3
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-9 border-t border-stone-200 pt-6">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.13em] text-stone-400">
              Your north stars
            </p>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-stone-600 hover:bg-stone-100">
              <span className="size-2 rounded-full bg-indigo-400" /> DSA mastery
            </button>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-stone-600 hover:bg-stone-100">
              <span className="size-2 rounded-full bg-orange-400" /> Career
              growth
            </button>
          </div>
          <button
            onClick={() => setShowCapture(true)}
            className="mt-8 flex items-center gap-2 px-3 text-xs font-semibold text-teal-700 hover:text-teal-900"
          >
            <CirclePlus className="size-4" /> Capture
          </button>
        </aside>

        <section className="min-w-0 px-4 py-7 sm:px-7 lg:px-9 xl:px-12">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-teal-700">
                Wednesday · September 3
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-[-0.055em] text-stone-900 sm:text-[34px]">
                Good morning, {firstName}.
              </h1>
              <p className="mt-1 text-[13px] text-stone-500">
                A realistic day:{' '}
                <span className="font-semibold text-stone-700">
                  3 priorities
                </span>
                , 3h 35m of focused work, 45m protected buffer.
              </p>
            </div>
            <button
              onClick={() => {
                setFocusTask(nextTask?.title || '');
                setShowFocus(true);
              }}
              className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 shadow-sm hover:bg-teal-100"
            >
              <TimerReset className="size-3.5" /> Start focus
            </button>
          </div>

          {!user && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
              <div>
                <p className="text-[12px] font-bold text-orange-950">
                  Make your workspace yours.
                </p>
                <p className="mt-0.5 text-[11px] text-orange-800/80">
                  Sign in with Google to save tasks, habits, and plans securely
                  across devices.
                </p>
              </div>
              <Button
                onClick={signIn}
                disabled={authLoading}
                size="sm"
                className="bg-teal-700 hover:bg-teal-800"
              >
                <LogIn className="size-3.5" /> Sign in with Google
              </Button>
            </div>
          )}
          {user && (
            <div className="mb-5 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
              <span
                className={
                  syncState === 'error'
                    ? 'text-rose-700'
                    : syncState === 'offline'
                      ? 'text-orange-700'
                      : 'text-teal-700'
                }
              >
                {syncState === 'saving' ? (
                  <>
                    <Cloud className="mr-1 inline size-3.5" /> Saving your
                    changes…
                  </>
                ) : syncState === 'offline' ? (
                  <>
                    <WifiOff className="mr-1 inline size-3.5" /> Offline —
                    changes are waiting safely on this device.
                  </>
                ) : syncState === 'error' ? (
                  <>
                    <CircleAlert className="mr-1 inline size-3.5" /> Your latest
                    change has not reached the cloud.
                  </>
                ) : (
                  <>
                    <Cloud className="mr-1 inline size-3.5" />{' '}
                    {cloudReady
                      ? 'Saved securely to your Google account'
                      : 'Loading your workspace…'}
                  </>
                )}
              </span>
              {(syncState === 'error' || syncState === 'offline') && (
                <button
                  onClick={retrySync}
                  className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-50"
                >
                  Retry sync
                </button>
              )}
            </div>
          )}
          {syncError && (
            <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50 p-3 text-[11px] text-orange-800">
              <span>{syncError}</span>
              <button
                onClick={() => setSyncError('')}
                aria-label="Dismiss sync message"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          {authError && (
            <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[11px] text-rose-700">
              <span>{authError}</span>
              <button
                onClick={() => setAuthError('')}
                aria-label="Dismiss message"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {activeNav === 'Today' ? (
            <>
              <div className="mb-5 rounded-2xl border border-teal-100 bg-[#eff8f6] p-4 sm:flex sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-teal-700 text-white">
                    <Target className="size-4" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-teal-950">
                      Right now: protect the first 90 minutes.
                    </p>
                    <p className="mt-0.5 text-[12px] text-teal-800/75">
                      Your hardest work is scheduled before the 10:45 standup —
                      a good match for your energy pattern.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFocusTask(nextTask?.title || '');
                    setShowFocus(true);
                  }}
                  className="mt-3 flex shrink-0 items-center gap-1.5 text-xs font-bold text-teal-800 hover:text-teal-950 sm:mt-0"
                >
                  Start focus <ChevronRight className="size-3.5" />
                </button>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(25,30,25,0.03)] sm:p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="font-display text-lg font-semibold tracking-[-0.035em]">
                        Today&apos;s plan
                      </h2>
                      <p className="text-[11px] text-stone-400">
                        Your work has a home in time — not just a list.
                      </p>
                    </div>
                    <button
                      className="grid size-7 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"
                      aria-label="More plan options"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </div>
                  <div className="mb-3 flex gap-2 overflow-x-auto border-b border-stone-100 pb-3">
                    <button className="rounded-md bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-700">
                      All {tasks.length}
                    </button>
                    <button className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-stone-400 hover:bg-stone-50">
                      Focus 2
                    </button>
                    <button className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-stone-400 hover:bg-stone-50">
                      Later 2
                    </button>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onToggle={toggleTask}
                      />
                    ))}
                  </div>
                  <form
                    onSubmit={handleQuickAdd}
                    className="mt-3 flex gap-2 border-t border-stone-100 pt-3"
                  >
                    <Plus className="mt-2 size-4 text-teal-700" />
                    <Input
                      value={quickAdd}
                      onChange={(event) => setQuickAdd(event.target.value)}
                      placeholder="Add to today..."
                      className="border-0 px-0 shadow-none focus-visible:ring-0"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      className="text-teal-700"
                    >
                      Add
                    </Button>
                  </form>
                </div>
                <div className="space-y-5">
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(25,30,25,0.03)]">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-base font-semibold tracking-[-0.03em]">
                        Daily capacity
                      </h2>
                      <span className="text-[10px] font-bold text-orange-600">
                        healthy
                      </span>
                    </div>
                    <div className="mt-4 flex items-end gap-1.5">
                      {[46, 68, 34, 82, 55, 20, 15].map((height, index) => (
                        <div key={height} className="flex-1">
                          <div
                            className={`rounded-t-sm ${index === 3 ? 'bg-teal-600' : 'bg-stone-200'}`}
                            style={{ height: `${height}px` }}
                          />
                          <p className="mt-1 text-center text-[8px] text-stone-400">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px]">
                      <span className="text-stone-500">Free focus time</span>
                      <span className="font-bold text-stone-800">
                        45 min buffer
                      </span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(25,30,25,0.03)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-display text-base font-semibold tracking-[-0.03em]">
                          Micro commitment
                        </h2>
                        <p className="mt-0.5 text-[10px] text-stone-400">
                          Small enough to repeat.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (requireAccount()) setHabitDone(!habitDone);
                        }}
                        className={`grid size-7 place-items-center rounded-full ${habitDone ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-400 hover:bg-teal-50 hover:text-teal-700'}`}
                        aria-label="Toggle micro commitment"
                      >
                        <Check className="size-3.5" />
                      </button>
                    </div>
                    <p
                      className={`mt-4 text-[12px] font-semibold ${habitDone ? 'text-teal-700 line-through' : 'text-stone-700'}`}
                    >
                      No phone until I&apos;m ready for office
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                        <div key={`${day}-${index}`}>
                          <div
                            className={`grid size-5 place-items-center rounded-full text-[9px] font-bold ${index < 2 || (index === 2 && habitDone) ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-400'}`}
                          >
                            {index < 2 || (index === 2 && habitDone) ? (
                              <Check className="size-3" />
                            ) : (
                              day
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] text-stone-400">
                      2-day rhythm · consistency, not streak pressure
                    </p>
                  </div>
                </div>
              </div>

              {(!profile.onboardingCompleted ||
                profile.features?.includes('projects')) && (
                <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(25,30,25,0.03)] sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600">
                        3-month direction
                      </p>
                      <h2 className="mt-1 font-display text-lg font-semibold tracking-[-0.035em]">
                        Become interview-ready in DSA
                      </h2>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
                      8 weeks left
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      ['Foundation', 74],
                      ['Patterns', 32],
                      ['Mock interviews', 0],
                    ].map(([label, amount]) => (
                      <div key={label as string}>
                        <div className="mb-1.5 flex justify-between text-[10px] text-stone-500">
                          <span>{label}</span>
                          <span>{amount}%</span>
                        </div>
                        <Progress
                          value={amount as number}
                          className="[&_[data-slot=progress-indicator]]:bg-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[11px] text-stone-500">
                    <span className="font-semibold text-stone-700">
                      This week:
                    </span>{' '}
                    3 of 5 focused sessions are protected in your calendar.
                  </p>
                </div>
              )}
            </>
          ) : (
            <NavigationPanel
              activeNav={activeNav}
              tasks={tasks}
              projects={projects}
              onAddProject={addProject}
              onUpdateProject={updateProject}
              onUploadImage={uploadAttachment}
            />
          )}
        </section>

        <aside className="border-l border-stone-200/80 bg-[#f9f8f5] px-5 py-7 lg:px-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-stone-400">
                Your day
              </p>
              <h2 className="font-display text-lg font-semibold tracking-[-0.035em]">
                On the calendar
              </h2>
            </div>
            <CalendarDays className="size-4 text-stone-400" />
          </div>
          <div className="relative border-l border-stone-200 pl-4">
            <div className="absolute -left-[3px] top-[21px] size-1.5 rounded-full bg-teal-600" />
            <p className="text-[10px] font-bold text-teal-700">NOW · 9:12 AM</p>
            <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3">
              <p className="text-[12px] font-bold text-indigo-950">
                DSA deep work
              </p>
              <p className="mt-1 text-[10px] text-indigo-700">
                9:00 – 10:30 · Focus
              </p>
            </div>
            {[
              ['10:45 AM', 'Engineering standup', '25 min · Google Calendar'],
              ['11:00 AM', 'Project brief review', '45 min · Work'],
              ['2:00 PM', 'Client sync', '60 min · Google Calendar'],
            ].map(([time, title, detail]) => (
              <div
                key={title}
                className="mt-5 border-t border-dashed border-stone-200 pt-4"
              >
                <p className="text-[10px] font-bold text-stone-400">{time}</p>
                <p className="mt-1 text-[12px] font-semibold text-stone-700">
                  {title}
                </p>
                <p className="text-[10px] text-stone-400">{detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-violet-100 bg-violet-50 p-3.5">
            <div className="flex items-center gap-2 text-violet-800">
              <Lightbulb className="size-4" />
              <p className="text-[11px] font-bold">
                Panda&apos;s quiet observation
              </p>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-violet-800/80">
              Your 4:00 PM task is flexible. Keep it unscheduled until after the
              client call.
            </p>
            <button
              onClick={() => {
                setHelpPrompt(
                  'Why is my afternoon overloaded, and what can I safely postpone?',
                );
                setPandaOpen(true);
              }}
              className="mt-3 flex items-center gap-1 text-[11px] font-bold text-violet-700 hover:text-violet-900"
            >
              Ask the Panda <ArrowUpRight className="size-3" />
            </button>
          </div>
        </aside>
      </div>

      {showSetup && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-stone-950/35 p-4 backdrop-blur-sm">
          <div className="mx-auto my-5 w-full max-w-2xl rounded-3xl border border-stone-200 bg-[#fbfaf7] p-6 shadow-2xl sm:my-10 sm:p-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700">
                  Your calm starting point
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]">
                  Set up the space you need now.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  Answer a few quick questions. Every other feature stays in
                  Settings until you want it.
                </p>
              </div>
              {profile.onboardingCompleted && (
                <button
                  onClick={() => setShowSetup(false)}
                  aria-label="Close workspace setup"
                >
                  <X className="size-4 text-stone-400" />
                </button>
              )}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-[11px] font-bold text-stone-600">
                What should we call you?
                <Input
                  autoFocus
                  value={setupName}
                  onChange={(event) => setSetupName(event.target.value)}
                  placeholder="Your first name"
                  className="mt-1.5 bg-white"
                />
              </label>
              <label className="text-[11px] font-bold text-stone-600">
                What are you using ManageMe for?
                <select
                  value={setupFocus}
                  onChange={(event) => {
                    const focus = event.target.value;
                    setSetupFocus(focus);
                    setSetupFeatures(
                      focus === 'Work'
                        ? ['tasks', 'projects', 'planner']
                        : focus === 'Study'
                          ? ['tasks', 'habit', 'projects']
                          : ['tasks', 'habit'],
                    );
                  }}
                  className="mt-1.5 h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal outline-none focus:border-teal-400"
                >
                  <option>Personal life</option>
                  <option>Work</option>
                  <option>Study</option>
                </select>
              </label>
            </div>
            <div className="mt-6">
              <p className="text-[11px] font-bold text-stone-600">
                What should appear first?
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(['tasks', 'habit', 'projects', 'planner'] as Feature[]).map(
                  (feature) => {
                    const labels: Record<Feature, [string, string]> = {
                      tasks: ['Today’s tasks', 'A short useful list'],
                      habit: ['Habit rhythm', 'One small commitment'],
                      projects: ['Projects', 'Longer goals without clutter'],
                      planner: ['Simple planner', 'Give tasks a place in time'],
                    };
                    const selected = setupFeatures.includes(feature);
                    return (
                      <button
                        key={feature}
                        onClick={() =>
                          setSetupFeatures((items) =>
                            selected
                              ? items.filter((item) => item !== feature)
                              : [...items, feature],
                          )
                        }
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selected ? 'border-teal-400 bg-teal-50' : 'border-stone-200 bg-white'}`}
                      >
                        <span
                          className={`grid size-5 place-items-center rounded-full border ${selected ? 'border-teal-600 bg-teal-600 text-white' : 'border-stone-300 text-transparent'}`}
                        >
                          <Check className="size-3" />
                        </span>
                        <span>
                          <span className="block text-xs font-bold text-stone-800">
                            {labels[feature][0]}
                          </span>
                          <span className="block text-[10px] text-stone-500">
                            {labels[feature][1]}
                          </span>
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
            <div className="mt-6">
              <p className="text-[11px] font-bold text-stone-600">
                Optional: give yourself one helpful starting point
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Input
                  value={setupTask}
                  onChange={(event) => setSetupTask(event.target.value)}
                  placeholder="First task"
                />
                <Input
                  value={setupHabit}
                  onChange={(event) => setSetupHabit(event.target.value)}
                  placeholder="Small habit"
                />
                <Input
                  value={setupProject}
                  onChange={(event) => setSetupProject(event.target.value)}
                  placeholder="First project"
                />
              </div>
            </div>
            <div className="mt-7 flex justify-end">
              <Button
                onClick={finishSetup}
                className="bg-teal-700 hover:bg-teal-800"
              >
                Create my layout <ArrowUpRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
      {showCapture && (
        <div className="fixed inset-0 z-50 grid place-items-start bg-stone-900/15 px-4 pt-[12vh] backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-stone-200 bg-white p-3 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-stone-100 px-2 pb-3">
              <Command className="size-4 text-teal-700" />
              <Input
                autoFocus
                value={quickAdd}
                onChange={(event) => setQuickAdd(event.target.value)}
                onKeyDown={(event) =>
                  event.key === 'Enter' && addTask(quickAdd)
                }
                placeholder="What do you want to remember?"
                className="h-9 border-0 px-0 text-base shadow-none focus-visible:ring-0"
              />
              <button
                onClick={() => setShowCapture(false)}
                aria-label="Close capture"
              >
                <X className="size-4 text-stone-400" />
              </button>
            </div>
            <div className="flex items-center justify-between px-2 pt-3">
              <p className="text-[11px] text-stone-400">
                Capture first. Organize later.
              </p>
              <Button
                onClick={() => addTask(quickAdd)}
                size="sm"
                className="bg-teal-700 hover:bg-teal-800"
              >
                Add to inbox
              </Button>
            </div>
          </div>
        </div>
      )}

      {showFocus && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#102c2b] p-4 text-white">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <Dumbbell className="absolute -left-4 top-[18%] size-36 -rotate-12 text-teal-300/10" />
            <BookOpen className="absolute right-3 top-20 size-40 rotate-12 text-orange-200/10" />
            <div className="absolute bottom-8 left-[20%] size-40 rounded-full bg-teal-400/10 blur-3xl" />
          </div>
          <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-3xl flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-teal-200">
                  Focus mode
                </p>
                <p className="mt-1 text-sm text-white/60">
                  One thing. One protected pocket of time.
                </p>
              </div>
              <button
                onClick={() => {
                  setFocusRunning(false);
                  setShowFocus(false);
                }}
                className="rounded-full border border-white/20 p-2 text-white/70 hover:bg-white/10"
                aria-label="Exit focus mode"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="my-8 text-center">
              <div className="mx-auto grid size-24 place-items-center rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl">
                <TimerReset className="size-10 text-teal-200" />
              </div>
              <p className="mt-8 text-sm font-bold uppercase tracking-[.14em] text-teal-200">
                {focusTask || 'Choose one task'}
              </p>
              <p className="mt-3 font-display text-7xl font-semibold tracking-[-.08em] sm:text-8xl">
                {String(Math.floor(focusRemaining / 60)).padStart(2, '0')}:
                {String(focusRemaining % 60).padStart(2, '0')}
              </p>
              <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-white/80">
                {
                  [
                    'Small steps, repeated, become a body of work.',
                    'Protect the work that makes tomorrow easier.',
                    'Your attention is your most valuable tool.',
                    'Consistency is quiet proof that you care.',
                  ][focusQuote % 4]
                }
              </p>
              <button
                onClick={() => setFocusQuote((index) => index + 1)}
                className="mt-3 text-xs font-bold text-teal-200 hover:text-white"
              >
                A fresh focus cue
              </button>
            </div>
            <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/15 bg-white/[.07] p-4 backdrop-blur">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Input
                  value={focusTask}
                  onChange={(event) => setFocusTask(event.target.value)}
                  placeholder="What are you focusing on?"
                  className="border-white/15 bg-white/10 text-white placeholder:text-white/40"
                />
                <select
                  value={focusMinutes}
                  onChange={(event) => {
                    const minutes = Number(event.target.value);
                    setFocusMinutes(minutes);
                    setFocusRemaining(minutes * 60);
                  }}
                  className="h-10 rounded-lg border border-white/15 bg-[#143635] px-3 text-sm"
                >
                  <option value={25}>25 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
              <div className="mt-4 flex justify-center gap-2">
                {focusRemaining === 0 ? (
                  <Button
                    onClick={() => {
                      setFocusRemaining(focusMinutes * 60);
                      setFocusRunning(false);
                    }}
                    className="bg-teal-300 text-teal-950 hover:bg-teal-200"
                  >
                    <RotateCcw className="size-4" /> Reset session
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      focusRunning
                        ? setFocusRunning(false)
                        : focusRemaining === focusMinutes * 60
                          ? startFocus()
                          : setFocusRunning(true)
                    }
                    className="bg-teal-300 text-teal-950 hover:bg-teal-200"
                  >
                    {focusRunning ? (
                      <>
                        <Pause className="size-4" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="size-4" />{' '}
                        {focusRemaining === focusMinutes * 60
                          ? 'Begin focus'
                          : 'Resume'}
                      </>
                    )}
                  </Button>
                )}
                <button
                  onClick={() => {
                    setFocusRunning(false);
                    setShowFocus(false);
                  }}
                  className="rounded-lg px-3 text-sm font-bold text-white/70 hover:bg-white/10"
                >
                  Finish
                </button>
              </div>
            </div>
            <p className="mt-7 text-center text-[11px] leading-relaxed text-white/45">
              This mode records the time you protect inside ManageMe. Mac-wide
              app tracking needs a small native Mac companion, so it never
              silently watches other apps.
            </p>
          </div>
        </div>
      )}

      {!showSetup && !showCapture && !showFocus && !showSettings && (
        <PandaCompanion
          open={pandaOpen}
          onOpenChange={setPandaOpen}
          connected={Boolean(apiKey)}
          providerName={
            provider === 'grok'
              ? 'Grok'
              : provider === 'openai'
                ? 'OpenAI'
                : 'Claude'
          }
          loading={memoLoading}
          answer={memoAnswer}
          error={memoError}
          prompt={helpPrompt}
          onPromptChange={setHelpPrompt}
          onAsk={askPanda}
          onOpenSettings={() => {
            setPandaOpen(false);
            setShowSettings(true);
          }}
        />
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-stone-900/25 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold tracking-[-0.04em]">
                  Connect the Panda&apos;s AI
                </h2>
                <p className="mt-1 text-[11px] text-stone-400">
                  Bring your own provider key. It is never saved to your
                  account.
                </p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                aria-label="Close AI settings"
              >
                <X className="size-4 text-stone-400" />
              </button>
            </div>
            <label className="mt-5 block text-[11px] font-bold text-stone-600">
              Provider
              <select
                value={provider}
                onChange={(event) =>
                  switchProvider(event.target.value as Provider)
                }
                className="mt-1.5 h-9 w-full rounded-lg border border-stone-200 bg-white px-2.5 text-sm font-normal outline-none focus:border-violet-300"
              >
                <option value="grok">Grok / xAI</option>
                <option value="openai">OpenAI</option>
                <option value="claude">Claude / Anthropic</option>
              </select>
            </label>
            <label className="mt-4 block text-[11px] font-bold text-stone-600">
              Model
              <Input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="mt-1.5"
              />
            </label>
            <label className="mt-4 block text-[11px] font-bold text-stone-600">
              API key
              <Input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste your key for this browser session"
                className="mt-1.5"
              />
            </label>
            <div className="mt-4 rounded-lg bg-stone-50 p-3 text-[11px] leading-relaxed text-stone-500">
              <KeyRound className="mr-1 inline size-3.5 text-teal-700" /> Your
              key stays in this browser session only. It is not committed to Git
              or stored by ManageMe.
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setApiKey('');
                  window.sessionStorage.removeItem('memo-api-key');
                }}
              >
                Forget key
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowSettings(false);
                  setPandaOpen(true);
                }}
                className="bg-violet-600 hover:bg-violet-700"
              >
                Save for this session
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
