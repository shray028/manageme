import { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle, indentUnit } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { javascript } from '@codemirror/lang-javascript';
import { go } from '@codemirror/lang-go';
import { oneDark } from '@codemirror/theme-one-dark';
import type { Language } from '@/lib/dsa/types';

const languageExtension = (language: Language) => {
  switch (language) {
    case 'python':
      return python();
    case 'java':
      return java();
    case 'cpp':
      return cpp();
    case 'javascript':
      return javascript();
    case 'typescript':
      return javascript({ typescript: true });
    case 'go':
      return go();
    default:
      return [];
  }
};

const indentFor = (language: Language) => (language === 'go' ? '\t' : language === 'python' || language === 'text' ? '    ' : '    ');

const baseTheme = EditorView.theme({
  '&': { fontSize: '15px', minHeight: 'min(62vh, 640px)', maxHeight: '80vh' },
  '.cm-scroller': { fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", lineHeight: '1.65', minHeight: 'min(62vh, 640px)' },
  '.cm-content': { padding: '14px 0' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': { borderRight: 'none', paddingLeft: '6px' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 6px' },
});

type Props = {
  value: string;
  language: Language;
  dark: boolean;
  label: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

/**
 * A LeetCode-style editor: syntax colours, line numbers, auto-indent, bracket matching,
 * Tab to indent. Plain-text mode works for written notes. Press Esc then Tab to leave the editor
 * with the keyboard.
 */
export default function CodeEditor({ value, language, dark, label, onChange, onBlur }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const languageSlot = useRef(new Compartment());
  const themeSlot = useRef(new Compartment());
  const indentSlot = useRef(new Compartment());
  const latestOnChange = useRef(onChange);
  const latestOnBlur = useRef(onBlur);
  latestOnChange.current = onChange;
  latestOnBlur.current = onBlur;

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        cmPlaceholder('Write your solution, or plain notes. Pick "Plain notes" above for text.'),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': label, 'aria-multiline': 'true' }),
        baseTheme,
        languageSlot.current.of(languageExtension(language)),
        indentSlot.current.of(indentUnit.of(indentFor(language))),
        themeSlot.current.of(dark ? oneDark : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) latestOnChange.current(update.state.doc.toString());
          if (update.focusChanged && !update.view.hasFocus) latestOnBlur.current?.();
        }),
      ],
    });
    view.current = new EditorView({ state, parent: host.current });
    return () => {
      view.current?.destroy();
      view.current = null;
    };
    // The editor is created once; later prop changes are applied through compartments below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current?.dispatch({
      effects: [languageSlot.current.reconfigure(languageExtension(language)), indentSlot.current.reconfigure(indentUnit.of(indentFor(language)))],
    });
  }, [language]);

  useEffect(() => {
    view.current?.dispatch({ effects: themeSlot.current.reconfigure(dark ? oneDark : []) });
  }, [dark]);

  // Accept changes from elsewhere (another device, restoring an old version) without fighting
  // the person while they type.
  useEffect(() => {
    const current = view.current;
    if (!current) return;
    const existing = current.state.doc.toString();
    if (existing === value) return;
    if (current.hasFocus) return;
    current.dispatch({ changes: { from: 0, to: existing.length, insert: value } });
  }, [value]);

  return <div ref={host} className={`dsa-editor ${dark ? 'is-dark' : ''}`} data-testid="code-editor" />;
}
