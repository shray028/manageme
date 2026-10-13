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
import { BrandLogo } from '@/components/brand-logo';
import { auth, db, firebaseApp, googleProvider } from '@/lib/firebase';
import { RoadmapView } from './roadmap-view';

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
  checks?: boolean[];
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
  /** The small daily habit the person chose during setup. */
  habit?: string;
};
type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

// New workspaces start empty — nothing is pre-filled from anyone else's life.
const defaults: Task[] = [];

const nav = [
  ['Today', CalendarDays],
  ['Inbox', Inbox],
  ['Planner', TimerReset],
  ['Projects', FolderKanban],
  ['Insights', BrainCircuit],
] as const;

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};
const minutesOf = (duration: string) => {
  const match = /(\d+)\s*(h|hr|hour|m|min)?/i.exec(duration);
  if (!match) return 0;
  const value = Number(match[1]);
  return match[2] && /^h/i.test(match[2]) ? value * 60 : value;
};
const formatMinutes = (total: number) => {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours ? `${hours}h${minutes ? ` ${minutes}m` : ''}` : `${minutes}m`;
};
/** Sort key for times like "9:00 AM"; unscheduled tasks go last. */
const timeRank = (time: string) => {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if (!match) return Number.POSITIVE_INFINITY;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + Number(match[2]);
};

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
        className={`grid size-5 shrink-0 place-items-center rounded-full border ${task.done ? 'border-sky-500 bg-sky-500 text-white' : 'border-stone-300 text-transparent hover:border-sky-500'}`}
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
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">
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
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">
          Keep it realistic
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Planner</h2>
        <div className="mt-6 space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-4 rounded-xl bg-stone-50 px-4 py-3"
            >
              <span className="w-24 text-xs font-bold text-blue-700">
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
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-600">
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
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
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
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
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
          className="bg-blue-600 hover:bg-blue-700"
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
                              className="flex items-center gap-1.5 truncate text-[10px] font-semibold text-blue-600 hover:underline"
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
  /** Days (YYYY-MM-DD) the habit was done, newest last. */
  const [habitLog, setHabitLog] = useState<string[]>([]);
  /** True when the cloud workspace failed to load: editing is paused so nothing can overwrite it. */
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pendingBackup, setPendingBackup] = useState<null | {
    tasks?: Task[];
    habitDone?: boolean;
    habitLog?: string[];
    projects?: Project[];
    profile?: WorkspaceProfile;
  }>(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const pendingBackupRef = useRef(pendingBackup);
  pendingBackupRef.current = pendingBackup;
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'done'>('all');
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
      setLoadFailed(false);
      setPendingBackup(null);
      setAuthError('');
      if (!nextUser) {
        setTasks(defaults);
        setHabitDone(false);
        setHabitLog([]);
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
            habitLog?: string[];
            projects?: Project[];
            profile?: WorkspaceProfile;
          };
          if (Array.isArray(saved.tasks)) setTasks(saved.tasks);
          const log = Array.isArray(saved.habitLog) ? saved.habitLog.filter((day) => typeof day === 'string') : [];
          setHabitLog(log);
          // Older workspaces only stored a yes/no flag; the log now decides what "done today" means.
          setHabitDone(Array.isArray(saved.habitLog) ? log.includes(todayKey()) : Boolean(saved.habitDone));
          if (Array.isArray(saved.projects)) {
            setProjects(saved.projects);
            // People following a 60-day roadmap keep landing on it, as before.
            if (saved.projects.some((project) => project?.title?.toLowerCase?.().includes('60-day roadmap')))
              setActiveNav('Roadmap');
          }
          const loadedProfile = saved.profile ?? {};
          setProfile(loadedProfile);
          setSetupName(
            loadedProfile.name || nextUser.displayName?.split(' ')[0] || '',
          );
          setSetupFocus(loadedProfile.focus || 'Personal life');
          setSetupHabit(loadedProfile.habit || '');
          setSetupFeatures(
            loadedProfile.features?.length
              ? loadedProfile.features
              : ['tasks', 'habit'],
          );
          if (!loadedProfile.onboardingCompleted) setShowSetup(true);
          // Changes that failed to save last time were kept on this device. Offer them back.
          try {
            const backup = window.localStorage.getItem(`manageme-pending-${nextUser.uid}`);
            if (backup) setPendingBackup(JSON.parse(backup));
          } catch {
            /* an unreadable backup is left untouched */
          }
        } else {
          // Bring any existing device-only data into the new account once.
          const legacyTasks = window.localStorage.getItem('manageme-tasks');
          const legacyHabit =
            window.localStorage.getItem('manageme-habit') === 'true';
          let initialTasks: Task[] = defaults;
          try {
            if (legacyTasks) initialTasks = JSON.parse(legacyTasks) as Task[];
          } catch {
            /* ignore unreadable legacy data */
          }
          setTasks(initialTasks);
          setHabitDone(legacyHabit);
          await setDoc(workspace, {
            tasks: initialTasks,
            habitDone: legacyHabit,
            habitLog: [],
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
          setLoadFailed(true);
          setSyncState('error');
          setSyncError(
            'We could not load your workspace, so editing is paused to keep your saved data safe. Check your connection and press Retry.',
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
  }, [loadAttempt]);
  useEffect(() => {
    if (!user || !cloudReady) return;
    const timeout = window.setTimeout(async () => {
      const backupKey = `manageme-pending-${user.uid}`;
      const workspaceData = {
        tasks,
        habitDone,
        habitLog,
        projects,
        profile,
        savedAt: Date.now(),
      };
      if (!navigator.onLine) {
        if (!pendingBackupRef.current) window.localStorage.setItem(backupKey, JSON.stringify(workspaceData));
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
        // Keep an older unsaved copy until the person decides what to do with it.
        if (!pendingBackupRef.current) window.localStorage.removeItem(backupKey);
        setSyncError('');
        setSyncState('saved');
      } catch {
        if (!pendingBackupRef.current) window.localStorage.setItem(backupKey, JSON.stringify(workspaceData));
        setSyncState('error');
        setSyncError(
          'Couldn’t save just now. Your changes are safely kept on this device. Retry when you are online.',
        );
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [tasks, habitDone, habitLog, projects, profile, user, cloudReady]);
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
    if (user && loadFailed) {
      setSyncError('Your workspace hasn’t loaded yet, so changes are paused to protect your saved data. Press Retry.');
      return false;
    }
    if (user) return true;
    setAuthError(
      'Sign in with Google to save your workspace and use it on every device.',
    );
    return false;
  };
  const toggleHabit = () => {
    if (!requireAccount()) return;
    const today = todayKey();
    const next = !habitDone;
    setHabitDone(next);
    setHabitLog((log) => {
      const without = log.filter((day) => day !== today);
      return (next ? [...without, today] : without).slice(-120);
    });
  };
  const restorePendingBackup = () => {
    if (!pendingBackup) return;
    if (Array.isArray(pendingBackup.tasks)) setTasks(pendingBackup.tasks);
    if (Array.isArray(pendingBackup.projects)) setProjects(pendingBackup.projects);
    if (Array.isArray(pendingBackup.habitLog)) {
      setHabitLog(pendingBackup.habitLog);
      setHabitDone(pendingBackup.habitLog.includes(todayKey()));
    }
    if (pendingBackup.profile) setProfile(pendingBackup.profile);
    setPendingBackup(null);
  };
  const discardPendingBackup = () => {
    if (!user) return;
    if (!window.confirm('Discard the unsaved changes kept on this device? Your saved workspace stays as it is.')) return;
    window.localStorage.removeItem(`manageme-pending-${user.uid}`);
    setPendingBackup(null);
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
    if (loadFailed || !cloudReady) {
      // Never push local state when we never saw the saved workspace — that could overwrite it.
      setSyncError('');
      setLoadAttempt((value) => value + 1);
      return;
    }
    setSyncState('saving');
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { tasks, habitDone, habitLog, projects, profile, updatedAt: serverTimestamp() },
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
    const features: Feature[] = setupFeatures.length ? setupFeatures : ['tasks'];
    setProfile((current) => ({
      ...current,
      onboardingCompleted: true,
      name: setupName.trim() || firstName,
      focus: setupFocus,
      features,
      habit: setupHabit.trim() || current.habit || '',
    }));
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
      <main className="grid min-h-screen place-items-center bg-[#f4f8ff] text-sm font-semibold text-blue-800">
        Preparing your calm space…
      </main>
    );
  if (!user)
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#f4f8ff] text-[#0b2454]">
        <div className="absolute -left-24 top-24 size-72 rounded-full bg-sky-100/80 blur-3xl" />
        <div className="absolute -right-24 bottom-4 size-80 rounded-full bg-cyan-100/80 blur-3xl" />
        <header className="relative z-10 mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
          <BrandLogo />
          <Button
            onClick={signIn}
            disabled={authLoading}
            className="bg-blue-700 hover:bg-blue-800"
          >
            <LogIn className="size-4" />
            {authLoading ? 'Opening Google…' : 'Start with Google'}
          </Button>
        </header>
        <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-5 pb-20 pt-12 md:grid-cols-[1.05fr_.95fr] md:pt-24">
          <div>
            <p className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold tracking-wide text-blue-800">
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
            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
              <a
                href="#/dsa"
                onClick={() => {
                  try {
                    window.localStorage.setItem('manageme:start', 'dsa');
                  } catch {
                    /* optional */
                  }
                }}
                className="rounded-2xl border border-sky-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400"
              >
                <span className="block text-base font-bold text-stone-900">Track DSA practice</span>
                <span className="mt-1 block text-sm text-stone-600">
                  Sheets like Striver&apos;s 180, done and revised checkboxes, code and notes per problem.
                </span>
              </a>
              <button
                type="button"
                onClick={signIn}
                disabled={authLoading}
                className="flex flex-col items-start rounded-2xl border border-cyan-200 bg-white p-4 text-left shadow-sm transition hover:border-cyan-500"
              >
                <span className="block text-base font-bold text-stone-900">
                  {authLoading ? 'Opening Google…' : 'Plan my days'}
                </span>
                <span className="mt-1 block text-sm text-stone-600">
                  Tasks, a small habit, focus sessions and project boards.
                </span>
              </button>
            </div>
            <p className="mt-3 text-xs font-semibold text-stone-500">
              Free to begin · Google sign-in keeps your data private
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-md rounded-[2.5rem] border border-white/80 bg-white/70 p-5 shadow-[0_24px_70px_rgba(23,105,216,.12)] backdrop-blur">
            <div className="rounded-[2rem] bg-[#edf8ff] px-6 pb-4 pt-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-700">
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
              <span className="rounded-xl bg-sky-50 px-2 py-3">
                Habit rhythm
              </span>
              <span className="rounded-xl bg-blue-50 px-2 py-3">
                Focus sessions
              </span>
              <span className="rounded-xl bg-cyan-50 px-2 py-3">
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

  const roadmapProject = projects.find((project) =>
    project.title.toLowerCase().includes('60-day roadmap'),
  );
  if (roadmapProject && activeNav === 'Roadmap') {
    const hasOldData =
      tasks.length > 0 ||
      habitDone ||
      projects.some((project) => project.id !== roadmapProject.id) ||
      (roadmapProject.cards ?? []).some((card) => card.id < 1 || card.id > 60 || !Array.isArray(card.checks));
    return (
      <RoadmapView
        name={firstName}
        project={roadmapProject}
        syncState={syncState}
        syncError={syncError}
        hasOldData={hasOldData}
        onRetrySync={retrySync}
        onSignOut={signOutOfManageMe}
        onBack={() => setActiveNav('Today')}
        onCheck={(day, index, checked, totalChecks) => {
          updateProject(roadmapProject.id, (project) => {
            const cards = project.cards ?? [];
            const previous = cards.find((card) => card.id === day);
            const checks = [...(previous?.checks ?? Array(totalChecks).fill(false))];
            checks[index] = checked;
            const status: BoardStatus = checks.every(Boolean)
              ? 'Done'
              : checks.some(Boolean)
                ? 'Doing'
                : 'Backlog';
            const updated: BoardCard = {
              id: day,
              title: `Day ${day}`,
              status,
              checks,
            };
            return {
              ...project,
              cards: previous
                ? cards.map((card) => (card.id === day ? updated : card))
                : [...cards, updated],
            };
          });
        }}
        onClearOldData={() => {
          if (
            !window.confirm(
              'Remove your daily tasks, the habit, and every project except this roadmap? This cannot be undone.',
            )
          )
            return;
          setTasks([]);
          setHabitDone(false);
          setProjects((items) =>
            items
              .filter((project) => project.id === roadmapProject.id)
              .map((project) => ({
                ...project,
                cards: (project.cards ?? []).filter(
                  (card) => card.id >= 1 && card.id <= 60 && Array.isArray(card.checks),
                ),
              })),
          );
        }}
      />
    );
  }

  const openTasks = tasks.filter((task) => !task.done);
  const priorityCount = openTasks.filter((task) => task.priority).length;
  const plannedMinutes = openTasks.reduce((total, task) => total + minutesOf(task.duration), 0);
  const scheduled = tasks
    .filter((task) => timeRank(task.time) !== Number.POSITIVE_INFINITY)
    .sort((a, b) => timeRank(a.time) - timeRank(b.time));
  const unscheduledCount = openTasks.filter((task) => timeRank(task.time) === Number.POSITIVE_INFINITY).length;
  const visibleTasks =
    taskFilter === 'open' ? openTasks : taskFilter === 'done' ? tasks.filter((task) => task.done) : tasks;
  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { key: dayKey(date), label: date.toLocaleDateString(undefined, { weekday: 'narrow' }), full: date.toLocaleDateString(undefined, { weekday: 'long' }) };
  });
  const habitDaysThisWeek = lastSevenDays.filter((day) => habitLog.includes(day.key)).length;
  const navItems = [...nav, ...(roadmapProject ? ([['Roadmap', Target]] as const) : [])];

  return (
    <main className="min-h-screen bg-[#f4f8ff] text-stone-900">
      <header className="sticky top-0 z-20 flex h-[65px] items-center justify-between border-b border-sky-200/80 bg-white/90 px-4 backdrop-blur md:px-7">
        <div className="flex items-center gap-3">
          <button
            className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 lg:hidden"
            aria-label={showMobileNav ? 'Close navigation' : 'Open navigation'}
            aria-expanded={showMobileNav}
            onClick={() => setShowMobileNav((value) => !value)}
          >
            {showMobileNav ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <BrandLogo compact />
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
          <a
            href="#/dsa"
            className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
          >
            <BookOpen className="size-3.5" /> DSA practice
          </a>
          <button
            onClick={() => {
              setFocusTask(nextTask?.title || '');
              setShowFocus(true);
            }}
            className="hidden items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-sky-100 sm:flex"
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
              className="bg-blue-700 text-[11px] hover:bg-blue-800"
            >
              <LogIn className="size-3.5" />
              {authLoading ? 'Opening Google…' : 'Sign in'}
            </Button>
          )}
        </div>
      </header>

      {showMobileNav && (
        <nav className="border-b border-stone-200 bg-white px-4 py-3 lg:hidden" aria-label="Workspace">
          <div className="flex flex-wrap gap-2">
            {navItems.map(([name, Icon]) => (
              <button
                key={name}
                onClick={() => {
                  setActiveNav(name);
                  setShowMobileNav(false);
                }}
                aria-current={activeNav === name ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${activeNav === name ? 'bg-sky-50 text-blue-800' : 'text-stone-600 hover:bg-stone-100'}`}
              >
                <Icon className="size-4" /> {name}
              </button>
            ))}
          </div>
        </nav>
      )}
      <div className="mx-auto grid max-w-[1550px] grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)_290px]">
        <aside className="hidden min-h-[calc(100vh-65px)] border-r border-stone-200/80 px-4 py-6 lg:block">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.13em] text-stone-400">
            Navigate
          </p>
          <nav className="space-y-1" aria-label="Workspace">
            {navItems.map(([name, Icon]) => (
              <button
                key={name}
                onClick={() => setActiveNav(name)}
                aria-current={activeNav === name ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ${activeNav === name ? 'bg-white text-blue-800 shadow-sm ring-1 ring-stone-200/70' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'}`}
              >
                <Icon className="size-4" /> {name}
                {name === 'Inbox' && unscheduledCount > 0 && (
                  <span className="ml-auto rounded-full bg-orange-100 px-1.5 text-[10px] font-bold text-orange-700">
                    {unscheduledCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-9 border-t border-stone-200 pt-6">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.13em] text-stone-400">
              Your projects
            </p>
            {projects.length ? (
              projects.slice(0, 6).map((project) => (
                <button
                  key={project.id}
                  onClick={() => setActiveNav(project.id === roadmapProject?.id ? 'Roadmap' : 'Projects')}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-stone-600 hover:bg-stone-100"
                >
                  <span className="size-2 shrink-0 rounded-full bg-blue-400" />
                  <span className="truncate">{project.title}</span>
                </button>
              ))
            ) : (
              <p className="px-3 text-[12px] text-stone-400">Projects you add show up here.</p>
            )}
            <a
              href="#/dsa"
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-stone-600 hover:bg-stone-100"
            >
              <BookOpen className="size-3.5 text-blue-500" /> DSA practice
            </a>
          </div>
          <button
            onClick={() => setShowCapture(true)}
            className="mt-8 flex items-center gap-2 px-3 text-xs font-semibold text-blue-700 hover:text-blue-900"
          >
            <CirclePlus className="size-4" /> Capture
          </button>
        </aside>

        <section className="min-w-0 px-4 py-7 sm:px-7 lg:px-9 xl:px-12">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-[-0.055em] text-stone-900 sm:text-[34px]">
                {greeting()}, {firstName}.
              </h1>
              <p className="mt-1 text-[13px] text-stone-500">
                {openTasks.length ? (
                  <>
                    {openTasks.length} open task{openTasks.length === 1 ? '' : 's'}
                    {priorityCount ? (
                      <>
                        {', '}
                        <span className="font-semibold text-stone-700">
                          {priorityCount} priorit{priorityCount === 1 ? 'y' : 'ies'}
                        </span>
                      </>
                    ) : null}
                    {plannedMinutes ? `, about ${formatMinutes(plannedMinutes)} of work planned.` : '.'}
                  </>
                ) : (
                  'Nothing planned yet. Add one useful thing for today.'
                )}
              </p>
            </div>
            <button
              onClick={() => {
                setFocusTask(nextTask?.title || '');
                setShowFocus(true);
              }}
              className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-blue-800 shadow-sm hover:bg-sky-100"
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
                className="bg-blue-700 hover:bg-blue-800"
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
                      : 'text-blue-700'
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
              {(syncState === 'error' || syncState === 'offline' || loadFailed) && (
                <button
                  onClick={retrySync}
                  className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-50"
                >
                  {loadFailed ? 'Retry loading' : 'Retry sync'}
                </button>
              )}
            </div>
          )}
          {pendingBackup && (
            <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-[12px] text-orange-950" role="alert">
              <p className="font-bold">Unsaved changes from an earlier visit were found on this device.</p>
              <p className="mt-1">
                They didn&apos;t reach your account last time. Restore them to replace what is shown now, or discard them.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={restorePendingBackup} className="bg-blue-700 hover:bg-blue-800">
                  Restore those changes
                </Button>
                <Button size="sm" variant="outline" onClick={discardPendingBackup}>
                  Discard
                </Button>
              </div>
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
              {roadmapProject && (
                <button
                  onClick={() => setActiveNav('Roadmap')}
                  className="mb-5 flex w-full items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-left hover:border-blue-300"
                >
                  <span>
                    <span className="block text-[12px] font-bold text-blue-950">Continue your 60-day roadmap</span>
                    <span className="block text-[12px] text-blue-800/80">Pick up where you left off.</span>
                  </span>
                  <ChevronRight className="size-4 text-blue-700" />
                </button>
              )}
              <div className="mb-5 rounded-2xl border border-sky-100 bg-[#eff8f6] p-4 sm:flex sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-blue-700 text-white">
                    <Target className="size-4" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-blue-950">
                      {openTasks.length ? `Next up: ${(openTasks.find((task) => task.priority) ?? openTasks[0]).title}` : 'Your list is clear.'}
                    </p>
                    <p className="mt-0.5 text-[12px] text-blue-800/75">
                      {openTasks.length
                        ? 'One thing at a time. Start a focus session when you are ready.'
                        : 'Capture something useful, or enjoy the space.'}
                    </p>
                  </div>
                </div>
                {openTasks.length > 0 && (
                  <button
                    onClick={() => {
                      setFocusTask((openTasks.find((task) => task.priority) ?? openTasks[0]).title);
                      setShowFocus(true);
                    }}
                    className="mt-3 flex shrink-0 items-center gap-1.5 text-xs font-bold text-blue-800 hover:text-blue-950 sm:mt-0"
                  >
                    Start focus <ChevronRight className="size-3.5" />
                  </button>
                )}
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

                  </div>
                  <div className="mb-3 flex gap-2 overflow-x-auto border-b border-stone-100 pb-3">
                    {(
                      [
                        ['all', `All ${tasks.length}`],
                        ['open', `To do ${openTasks.length}`],
                        ['done', `Done ${tasks.length - openTasks.length}`],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setTaskFilter(value)}
                        aria-pressed={taskFilter === value}
                        className={`rounded-md px-2.5 py-1 text-[11px] ${taskFilter === value ? 'bg-stone-100 font-bold text-stone-700' : 'font-semibold text-stone-500 hover:bg-stone-50'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="divide-y divide-stone-100">
                    {!visibleTasks.length && (
                      <p className="px-2 py-4 text-[12px] text-stone-400">
                        {tasks.length ? 'Nothing here.' : 'No tasks yet. Add your first one below.'}
                      </p>
                    )}
                    {visibleTasks.map((task) => (
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
                    <Plus className="mt-2 size-4 text-blue-700" />
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
                      className="text-blue-700"
                    >
                      Add
                    </Button>
                  </form>
                </div>
                <div className="space-y-5">
                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(25,30,25,0.03)]">
                    <h2 className="font-display text-base font-semibold tracking-[-0.03em]">
                      Today&apos;s progress
                    </h2>
                    <p className="mt-3 font-display text-3xl font-semibold">
                      {tasks.length - openTasks.length}/{tasks.length}
                    </p>
                    <p className="text-[11px] text-stone-500">tasks done</p>
                    <Progress
                      value={tasks.length ? ((tasks.length - openTasks.length) / tasks.length) * 100 : 0}
                      className="mt-3 [&_[data-slot=progress-indicator]]:bg-cyan-700"
                    />
                    <p className="mt-3 text-[11px] text-stone-500">
                      {plannedMinutes ? `About ${formatMinutes(plannedMinutes)} of work left.` : 'No time planned yet.'}
                    </p>
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
                        onClick={toggleHabit}
                        className={`grid size-7 place-items-center rounded-full ${habitDone ? 'bg-cyan-700 text-white' : 'bg-stone-100 text-stone-400 hover:bg-sky-50 hover:text-blue-700'}`}
                        aria-label="Toggle micro commitment"
                      >
                        <Check className="size-3.5" />
                      </button>
                    </div>
                    {profile.habit ? (
                      <p
                        className={`mt-4 text-[12px] font-semibold ${habitDone ? 'text-blue-700 line-through' : 'text-stone-700'}`}
                      >
                        {profile.habit}
                      </p>
                    ) : (
                      <form
                        className="mt-4 flex gap-1.5"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const habit = setupHabit.trim();
                          if (!habit || !requireAccount()) return;
                          setProfile((current) => ({ ...current, habit }));
                        }}
                      >
                        <Input
                          value={setupHabit}
                          onChange={(event) => setSetupHabit(event.target.value)}
                          placeholder="e.g. 10 minutes of reading"
                          aria-label="Your small daily habit"
                          className="h-8 text-[12px]"
                        />
                        <Button type="submit" size="sm" className="h-8 bg-blue-700 hover:bg-blue-800">
                          Set
                        </Button>
                      </form>
                    )}
                    <div className="mt-4 flex items-center justify-between" aria-label={`Done on ${habitDaysThisWeek} of the last 7 days`}>
                      {lastSevenDays.map((day) => {
                        const done = habitLog.includes(day.key);
                        return (
                          <div key={day.key} title={`${day.full}: ${done ? 'done' : 'not done'}`}>
                            <div
                              className={`grid size-5 place-items-center rounded-full text-[9px] font-bold ${done ? 'bg-cyan-700 text-white' : 'bg-stone-100 text-stone-500'}`}
                            >
                              {done ? <Check className="size-3" /> : day.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[10px] text-stone-500">
                      {habitDaysThisWeek} of the last 7 days · consistency, not streak pressure
                    </p>
                  </div>
                </div>
              </div>

              {projects.filter((project) => project.id !== roadmapProject?.id).length > 0 && (
                <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(25,30,25,0.03)] sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold tracking-[-0.035em]">Projects</h2>
                    <button
                      onClick={() => setActiveNav('Projects')}
                      className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900"
                    >
                      Open boards <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {projects
                      .filter((project) => project.id !== roadmapProject?.id)
                      .slice(0, 6)
                      .map((project) => {
                        const cards = project.cards ?? [];
                        const done = cards.filter((card) => card.status === 'Done').length;
                        const amount = cards.length ? Math.round((done / cards.length) * 100) : 0;
                        return (
                          <div key={project.id}>
                            <div className="mb-1.5 flex justify-between gap-2 text-[11px] text-stone-600">
                              <span className="truncate">{project.title}</span>
                              <span className="shrink-0">
                                {done}/{cards.length} done
                              </span>
                            </div>
                            <Progress
                              value={amount}
                              className="[&_[data-slot=progress-indicator]]:bg-blue-500"
                            />
                          </div>
                        );
                      })}
                  </div>
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
                Scheduled today
              </h2>
            </div>
            <CalendarDays className="size-4 text-stone-400" />
          </div>
          {scheduled.length ? (
            <ol className="relative space-y-4 border-l border-stone-200 pl-4">
              {scheduled.map((task) => (
                <li key={task.id}>
                  <p className="text-[10px] font-bold text-stone-500">{task.time}</p>
                  <p className={`mt-1 text-[12px] font-semibold ${task.done ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                    {task.title}
                  </p>
                  <p className="text-[10px] text-stone-500">
                    {task.duration} · {task.tag}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[12px] leading-relaxed text-stone-500">
              Tasks with a time show up here in order. {unscheduledCount ? `${unscheduledCount} task${unscheduledCount === 1 ? ' is' : 's are'} still unscheduled.` : ''}
            </p>
          )}
          <div className="mt-8 rounded-xl border border-violet-100 bg-violet-50 p-3.5">
            <div className="flex items-center gap-2 text-violet-800">
              <Lightbulb className="size-4" />
              <p className="text-[11px] font-bold">
                Panda&apos;s quiet observation
              </p>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-violet-800/80">
              {openTasks.length > 3
                ? `You have ${openTasks.length} open tasks. Ask which ones can safely wait.`
                : 'Ask for help shaping today into something realistic.'}
            </p>
            <button
              onClick={() => {
                setHelpPrompt(
                  openTasks.length > 3
                    ? 'Which of my tasks today can I safely postpone?'
                    : 'Help me plan a realistic day.',
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
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">
                  Your calm starting point
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em]">
                  Set up the space you need now.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">
                  Answer a few quick questions. Every other feature stays in
                  Settings until you want it.
                </p>
                <p className="mt-2 text-sm text-stone-600">
                  Only here for DSA practice?{' '}
                  <a
                    href="#/dsa"
                    onClick={() => {
                      setShowSetup(false);
                      try {
                        window.localStorage.setItem('manageme:start', 'dsa');
                      } catch {
                        /* optional */
                      }
                    }}
                    className="font-semibold text-blue-700 underline underline-offset-2"
                  >
                    Go straight to the DSA tracker
                  </a>
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
                  className="mt-1.5 h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm font-normal outline-none focus:border-cyan-400"
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
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selected ? 'border-cyan-400 bg-sky-50' : 'border-stone-200 bg-white'}`}
                      >
                        <span
                          className={`grid size-5 place-items-center rounded-full border ${selected ? 'border-cyan-700 bg-cyan-700 text-white' : 'border-stone-300 text-transparent'}`}
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
                className="bg-blue-700 hover:bg-blue-800"
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
              <Command className="size-4 text-blue-700" />
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
                className="bg-blue-700 hover:bg-blue-800"
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
            <Dumbbell className="absolute -left-4 top-[18%] size-36 -rotate-12 text-cyan-300/10" />
            <BookOpen className="absolute right-3 top-20 size-40 rotate-12 text-orange-200/10" />
            <div className="absolute bottom-8 left-[20%] size-40 rounded-full bg-cyan-400/10 blur-3xl" />
          </div>
          <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-3xl flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-sky-200">
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
                <TimerReset className="size-10 text-sky-200" />
              </div>
              <p className="mt-8 text-sm font-bold uppercase tracking-[.14em] text-sky-200">
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
                className="mt-3 text-xs font-bold text-sky-200 hover:text-white"
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
                    className="bg-cyan-300 text-blue-950 hover:bg-sky-200"
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
                    className="bg-cyan-300 text-blue-950 hover:bg-sky-200"
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
              <KeyRound className="mr-1 inline size-3.5 text-blue-700" /> Your
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
