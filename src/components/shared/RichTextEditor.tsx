import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { useEffect, useMemo } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  Code, Link2, Link2Off, RemoveFormatting, Undo2, Redo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export const MAX_WORDS = 20_000;

export function countWords(html: string): number {
  if (!html) return 0;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const text = (tmp.innerText || tmp.textContent || '').trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  /** Max visible height before the editor scrolls internally. Defaults to 360px. */
  maxHeight?: number;
  /** Word limit. Defaults to 20,000. */
  maxWords?: number;
}

const ToolbarBtn = ({
  onClick, active, disabled, label, children,
}: { onClick: () => void; active?: boolean; disabled?: boolean; label: string; children: React.ReactNode }) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={cn('h-7 w-7 p-0', active && 'bg-muted text-foreground')}
  >
    {children}
  </Button>
);

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/30 px-1 py-1 rounded-t-md sticky top-0 z-10">
      <ToolbarBtn label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></ToolbarBtn>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarBtn label="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn label="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-3.5 w-3.5" /></ToolbarBtn>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarBtn label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn label="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code className="h-3.5 w-3.5" /></ToolbarBtn>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarBtn label="Add or edit link" active={editor.isActive('link')} onClick={setLink}><Link2 className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn label="Remove link" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()}><Link2Off className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="h-3.5 w-3.5" /></ToolbarBtn>
      <Separator orientation="vertical" className="mx-1 h-5" />
      <ToolbarBtn label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-3.5 w-3.5" /></ToolbarBtn>
      <ToolbarBtn label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-3.5 w-3.5" /></ToolbarBtn>
    </div>
  );
}

export function RichTextEditor({
  value, onChange, placeholder, className,
  minHeight = 200, maxHeight = 360, maxWords = MAX_WORDS,
}: RichTextEditorProps) {
  const editor = useEditor({
    // StarterKit (v3+) already includes Underline; disable it to avoid the duplicate-extension warning,
    // then add our own Underline so older StarterKit versions (without it) still work.
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2',
          'prose-headings:font-semibold prose-a:text-primary',
        ),
        'data-placeholder': placeholder ?? '',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // tiptap returns "<p></p>" for empty content; normalise to ""
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  // Sync external value changes (e.g. when opening dialog for a different document)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || '';
    if (next !== current && !(next === '' && current === '<p></p>')) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [value, editor]);

  const words = useMemo(() => countWords(value || ''), [value]);
  const overLimit = words > maxWords;

  if (!editor) return null;

  return (
    <div className={cn('rounded-md border border-input bg-background flex flex-col', className)}>
      <Toolbar editor={editor} />
      <div
        className="overflow-auto"
        style={{ minHeight, maxHeight }}
      >
        <EditorContent editor={editor} />
      </div>
      <div className={cn(
        'flex items-center justify-between gap-2 border-t border-input px-3 py-1.5 text-xs',
        overLimit ? 'text-destructive' : 'text-muted-foreground',
      )}>
        <span>
          {words.toLocaleString()} / {maxWords.toLocaleString()} words
        </span>
        {overLimit && <span>Over the {maxWords.toLocaleString()}-word limit</span>}
      </div>
    </div>
  );
}

export default RichTextEditor;
