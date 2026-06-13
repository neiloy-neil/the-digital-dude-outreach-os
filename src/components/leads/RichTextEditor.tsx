'use client';

import { useEffect, useRef, type MouseEvent } from 'react';
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Underline } from 'lucide-react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

function runCommand(command: string, value?: string) {
  if (typeof document === 'undefined') return;
  document.execCommand(command, false, value);
}

function formatSelectionAsLink() {
  const url = window.prompt('Enter a link URL');
  if (!url) return;
  runCommand('createLink', url);
}

export default function RichTextEditor({ value, onChange, placeholder, className = '' }: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== value && document.activeElement !== editor) {
      editor.innerHTML = value || '<p><br></p>';
    }
  }, [value]);

  const update = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(editor.innerHTML);
  };

  const handleMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <div className={`overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] ${className}`}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2">
        <button type="button" onMouseDown={handleMouseDown} onClick={() => runCommand('bold')} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
          <Bold className="h-3.5 w-3.5" />
          Bold
        </button>
        <button type="button" onMouseDown={handleMouseDown} onClick={() => runCommand('italic')} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
          <Italic className="h-3.5 w-3.5" />
          Italic
        </button>
        <button type="button" onMouseDown={handleMouseDown} onClick={() => runCommand('underline')} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
          <Underline className="h-3.5 w-3.5" />
          Underline
        </button>
        <button type="button" onMouseDown={handleMouseDown} onClick={() => runCommand('insertUnorderedList')} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
          <List className="h-3.5 w-3.5" />
          Bullets
        </button>
        <button type="button" onMouseDown={handleMouseDown} onClick={() => runCommand('insertOrderedList')} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
          <ListOrdered className="h-3.5 w-3.5" />
          Numbered
        </button>
        <button type="button" onMouseDown={handleMouseDown} onClick={formatSelectionAsLink} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">
          <LinkIcon className="h-3.5 w-3.5" />
          Link
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={update}
        onBlur={update}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain');
          runCommand('insertText', text);
        }}
        className="min-h-[280px] px-4 py-3 text-sm leading-6 text-zinc-900 outline-none empty:before:pointer-events-none empty:before:text-zinc-400 empty:before:content-[attr(data-placeholder)] [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:mb-1 [&_a]:text-blue-600 [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: value || '<p><br></p>' }}
      />
    </div>
  );
}
