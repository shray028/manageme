'use client';

/* oxlint-disable react/react-compiler -- Timed state changes are the Panda's frame animation timeline. */

import { useEffect, useRef, useState } from 'react';
import { KeyRound, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PandaPhase =
  | 'sleeping'
  | 'stirring'
  | 'sitting'
  | 'rising'
  | 'awake'
  | 'thinking';

const phaseImage: Record<PandaPhase, string> = {
  sleeping: '/panda/sleeping-clean.png',
  stirring: '/panda/wake-1.png',
  sitting: '/panda/wake-2.png',
  rising: '/panda/wake-3.png',
  awake: '/panda/awake-small.png',
  thinking: '/panda/awake-small.png',
};

type PandaCompanionProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connected: boolean;
  providerName: string;
  loading: boolean;
  answer: string;
  error: string;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onAsk: (prompt: string) => void;
  onOpenSettings: () => void;
};

export function PandaCompanion({
  open,
  onOpenChange,
  connected,
  providerName,
  loading,
  answer,
  error,
  prompt,
  onPromptChange,
  onAsk,
  onOpenSettings,
}: PandaCompanionProps) {
  const [phase, setPhase] = useState<PandaPhase>('sleeping');
  const [bubbleMounted, setBubbleMounted] = useState(false);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const timers = useRef<number[]>([]);
  const animationFrames = useRef<number[]>([]);
  const hasOpened = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const clearAnimationQueue = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    animationFrames.current.forEach((frame) =>
      window.cancelAnimationFrame(frame),
    );
    animationFrames.current = [];
  };

  useEffect(() => {
    [
      '/panda/sleeping-clean.png',
      '/panda/wake-1.png',
      '/panda/wake-2.png',
      '/panda/wake-3.png',
      '/panda/awake-small.png',
    ].forEach((source) => {
      const image = new Image();
      image.src = source;
    });
  }, []);

  useEffect(() => {
    clearAnimationQueue();
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (open) {
      hasOpened.current = true;
      if (reduceMotion) {
        setPhase('awake');
        setBubbleMounted(true);
        setBubbleVisible(true);
        return clearAnimationQueue;
      }

      setPhase('stirring');
      timers.current.push(window.setTimeout(() => setPhase('sitting'), 190));
      timers.current.push(window.setTimeout(() => setPhase('rising'), 410));
      timers.current.push(
        window.setTimeout(() => {
          setBubbleMounted(true);
          animationFrames.current.push(
            window.requestAnimationFrame(() => setBubbleVisible(true)),
          );
        }, 500),
      );
      timers.current.push(window.setTimeout(() => setPhase('awake'), 760));
    } else {
      if (!hasOpened.current) return clearAnimationQueue;

      setBubbleVisible(false);
      if (reduceMotion) {
        setBubbleMounted(false);
        setPhase('sleeping');
        return clearAnimationQueue;
      }

      setPhase('sitting');
      timers.current.push(window.setTimeout(() => setPhase('stirring'), 190));
      timers.current.push(window.setTimeout(() => setPhase('sleeping'), 430));
      timers.current.push(
        window.setTimeout(() => setBubbleMounted(false), 430),
      );
    }
    return clearAnimationQueue;
  }, [open]);

  useEffect(() => {
    if (!open || !bubbleMounted) return;
    const focusTimer = window.setTimeout(
      () => textareaRef.current?.focus(),
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 120,
    );
    return () => window.clearTimeout(focusTimer);
  }, [bubbleMounted, open]);

  useEffect(() => {
    if (!open && hasOpened.current) triggerRef.current?.focus();
  }, [open]);

  const displayedPhase: PandaPhase = loading && open ? 'thinking' : phase;

  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const question = prompt.trim();
    if (!loading && question) onAsk(question);
  };

  return (
    <div className="panda-companion fixed bottom-3 right-3 z-[76] sm:bottom-5 sm:right-5">
      {bubbleMounted && (
        <dialog
          id="panda-assistant-dialog"
          open
          aria-label="Panda assistant"
          className={`panda-chat ${bubbleVisible ? 'panda-chat--visible' : ''}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div aria-live="polite" aria-atomic="true">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-violet-600">
                {loading ? 'Thinking with you' : 'Your productivity Panda'}
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold leading-tight text-stone-900">
                {loading
                  ? 'Give me one tiny moment…'
                  : 'I’m awake — what are we working on?'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                {connected
                  ? `${providerName} is connected for personal planning.`
                  : 'I can explain ManageMe without an AI key.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              aria-label="Let the Panda rest"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-violet-50 p-3 text-sm leading-relaxed text-violet-950">
            {connected
              ? 'Tell me what feels stuck. I’ll use your current task context to help.'
              : 'Try “How do projects work?” or “Where do I add a habit?”'}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                onPromptChange('How do projects and attachments work?')
              }
              className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:border-violet-200 hover:bg-violet-50"
            >
              Projects
            </button>
            <button
              type="button"
              onClick={() => onPromptChange('How do I use focus mode?')}
              className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:border-violet-200 hover:bg-violet-50"
            >
              Focus mode
            </button>
          </div>

          <form onSubmit={submit} className="mt-3">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !loading) {
                  event.preventDefault();
                  if (prompt.trim()) onAsk(prompt.trim());
                }
              }}
              placeholder="Ask the Panda anything…"
              className="min-h-24 w-full resize-none rounded-2xl border border-stone-200 bg-white p-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-violet-900"
              >
                <KeyRound className="size-3.5" />{' '}
                {connected ? 'AI settings' : 'Connect AI'}
              </button>
              <Button
                type="submit"
                size="sm"
                disabled={loading || !prompt.trim()}
                className="rounded-full bg-violet-600 px-4 hover:bg-violet-700"
              >
                <Send className="size-3.5" /> {loading ? 'Thinking…' : 'Send'}
              </Button>
            </div>
          </form>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-relaxed text-rose-700"
            >
              {error}
            </p>
          )}
          {answer && (
            <output
              aria-live="polite"
              className="mt-3 block max-h-36 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-[#f8f7ff] p-3 text-sm leading-relaxed text-violet-950"
            >
              {answer}
            </output>
          )}

          <div className="panda-thought-tail" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </dialog>
      )}

      <div className="relative ml-auto h-[118px] w-[132px] sm:h-[132px] sm:w-[150px]">
        {!open && (
          <div className="panda-dream" aria-hidden="true">
            <span>z</span>
            <span>z</span>
            <span>z</span>
          </div>
        )}
        {loading && open && (
          <div className="panda-question" aria-hidden="true">
            ?
          </div>
        )}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => onOpenChange(!open)}
          className={`panda-trigger panda-phase-${displayedPhase}`}
          aria-label={
            open ? 'Panda assistant is awake' : 'Wake the Panda assistant'
          }
          aria-expanded={open}
          aria-controls={bubbleMounted ? 'panda-assistant-dialog' : undefined}
        >
          <span className="panda-glow" aria-hidden="true" />
          {/* oxlint-disable-next-line next/no-img-element -- Local frame sequence needs direct image swaps without Next runtime. */}
          <img
            key={displayedPhase}
            src={phaseImage[displayedPhase]}
            alt=""
            className="panda-character"
          />
        </button>
      </div>
    </div>
  );
}
