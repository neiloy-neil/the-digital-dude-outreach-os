'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Underline as UnderlineIcon, Undo, Redo } from 'lucide-react';
import { useEffect } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export default function RichTextEditor({ value, onChange, placeholder, className = '' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Write something...',
      }),
    ],
    content: value || '<p><br></p>',
    editorProps: {
      attributes: {
        class: `min-h-[280px] px-4 py-3 text-sm leading-6 text-zinc-900 outline-none [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:mb-1 [&_a]:text-blue-600 [&_a]:underline [&_p.is-editor-empty:first-child::before]:text-zinc-400 [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:pointer-events-none`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync value changes from outside (if needed)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p><br></p>', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const toolbarBtnClass = "inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50 disabled:cursor-not-allowed";
  const activeBtnClass = "inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 transition";

  return (
    <div className={`overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] ${className}`}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2">
        <button type="button" onMouseDown={handleMouseDown} onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? activeBtnClass : toolbarBtnClass}>
          <Bold className="h-3.5 w-3.5" />
          Bold
        </button>
        <button type="button" onMouseDown={handleMouseDown} onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? activeBtnClass : toolbarBtnClass}>
          <Italic className="h-3.5 w-3.5" />
          Italic
        </button>
        <button type="button" onMouseDown={handleMouseDown} onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? activeBtnClass : toolbarBtnClass}>
          <UnderlineIcon className="h-3.5 w-3.5" />
          Underline
        </button>
        <div className="w-px h-4 bg-[var(--border)] mx-1" />
        <button type="button" onMouseDown={handleMouseDown} onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? activeBtnClass : toolbarBtnClass}>
          <List className="h-3.5 w-3.5" />
          Bullets
        </button>
        <button type="button" onMouseDown={handleMouseDown} onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? activeBtnClass : toolbarBtnClass}>
          <ListOrdered className="h-3.5 w-3.5" />
          Numbered
        </button>
        <div className="w-px h-4 bg-[var(--border)] mx-1" />
        <button type="button" onMouseDown={handleMouseDown} onClick={setLink} className={editor.isActive('link') ? activeBtnClass : toolbarBtnClass}>
          <LinkIcon className="h-3.5 w-3.5" />
          Link
        </button>
        <div className="w-px h-4 bg-[var(--border)] mx-1" />
        <button type="button" onMouseDown={handleMouseDown} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={toolbarBtnClass}>
          <Undo className="h-3.5 w-3.5" />
          Undo
        </button>
        <button type="button" onMouseDown={handleMouseDown} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={toolbarBtnClass}>
          <Redo className="h-3.5 w-3.5" />
          Redo
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
