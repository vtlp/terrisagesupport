import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StickyNote, FileText, Database, Building2, MessageSquare, Settings } from 'lucide-react';

interface NoteRow { id: string; note_text: string; created_at: string }

interface Props {
  accountId: string;
  notes: NoteRow[];
  onChanged: () => void;
}

type Category = 'Onboarding' | 'Lead import' | 'Property import' | 'Project' | 'System' | 'Manual';

interface ParsedNote { id: string; created_at: string; category: Category; subject?: string; body: string }

const CATEGORY_ORDER: Category[] = ['Onboarding', 'Lead import', 'Property import', 'Project', 'Manual', 'System'];

const CATEGORY_META: Record<Category, { icon: React.ReactNode; tone: string }> = {
  'Onboarding':       { icon: <FileText className="h-3.5 w-3.5" />,    tone: 'bg-primary/10 text-primary border-primary/20' },
  'Lead import':      { icon: <Database className="h-3.5 w-3.5" />,    tone: 'bg-accent/30 text-accent-foreground border-accent/40' },
  'Property import':  { icon: <Building2 className="h-3.5 w-3.5" />,   tone: 'bg-secondary text-secondary-foreground border-border' },
  'Project':          { icon: <Building2 className="h-3.5 w-3.5" />,   tone: 'bg-success/10 text-success border-success/20' },
  'System':           { icon: <Settings className="h-3.5 w-3.5" />,    tone: 'bg-muted text-muted-foreground border-border' },
  'Manual':           { icon: <MessageSquare className="h-3.5 w-3.5" />, tone: 'bg-muted text-foreground border-border' },
};

function parse(note: NoteRow): ParsedNote {
  const m = /^\[([^\]]+)\]\s*(.*)$/s.exec(note.note_text);
  if (m) {
    const tag = m[1].trim();
    const body = m[2];
    if (tag.toLowerCase().startsWith('project:')) {
      return { id: note.id, created_at: note.created_at, category: 'Project', subject: tag.slice(8).trim(), body };
    }
    if (tag === 'Onboarding') return { id: note.id, created_at: note.created_at, category: 'Onboarding', body };
    if (tag === 'Lead import') return { id: note.id, created_at: note.created_at, category: 'Lead import', body };
    if (tag === 'Property import') return { id: note.id, created_at: note.created_at, category: 'Property import', body };
    if (tag === 'System') return { id: note.id, created_at: note.created_at, category: 'System', body };
  }
  return { id: note.id, created_at: note.created_at, category: 'Manual', body: note.note_text };
}

export function CategorizedNotes({ accountId, notes, onChanged }: Props) {
  const [newNote, setNewNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Category | 'All'>('All');

  const parsed = useMemo(() => notes.map(parse), [notes]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: parsed.length };
    parsed.forEach(p => { c[p.category] = (c[p.category] ?? 0) + 1; });
    return c;
  }, [parsed]);

  const visibleCats = CATEGORY_ORDER.filter(c => (counts[c] ?? 0) > 0);

  const grouped = useMemo(() => {
    const list = filter === 'All' ? parsed : parsed.filter(p => p.category === filter);
    const map = new Map<Category, ParsedNote[]>();
    list.forEach(p => {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    });
    return CATEGORY_ORDER.map(c => [c, map.get(c) ?? []] as const).filter(([, arr]) => arr.length > 0);
  }, [parsed, filter]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('account_notes').insert({ account_id: accountId, note_text: newNote.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setNewNote('');
    onChanged();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" />
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note…" rows={2} />
          <Button onClick={addNote} disabled={!newNote.trim() || busy}>Add</Button>
        </div>

        <Separator />

        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filter === 'All'} onClick={() => setFilter('All')} label={`All (${counts.All ?? 0})`} />
          {visibleCats.map(c => (
            <FilterChip
              key={c}
              active={filter === c}
              onClick={() => setFilter(c)}
              label={`${c} (${counts[c] ?? 0})`}
              icon={CATEGORY_META[c].icon}
            />
          ))}
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No notes in this category.</p>
          ) : grouped.map(([cat, items]) => (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`${CATEGORY_META[cat].tone} text-[10px] gap-1`}>
                  {CATEGORY_META[cat].icon}
                  {cat}
                </Badge>
                <span className="text-[11px] text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(n => (
                  <div key={n.id} className="text-sm border-l-2 border-primary/30 pl-3 py-1">
                    {n.subject && <div className="text-xs font-medium text-muted-foreground mb-0.5">{n.subject}</div>}
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), 'dd MMM, HH:mm')}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterChip({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1 transition-colors ${
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border text-muted-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
