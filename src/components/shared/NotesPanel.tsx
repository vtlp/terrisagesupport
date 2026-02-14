import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Plus } from 'lucide-react';
import { format } from 'date-fns';
import type { Note } from '@/types/core';
import { getUserName } from '@/data/seedData';

interface NotesPanelProps {
  notes: Note[];
  onAddNote?: (text: string) => void;
  compact?: boolean;
}

export function NotesPanel({ notes, onAddNote, compact = false }: NotesPanelProps) {
  const [newNote, setNewNote] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    if (newNote.trim() && onAddNote) {
      onAddNote(newNote.trim());
      setNewNote('');
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Notes ({notes.length})
        </h3>
        {onAddNote && !showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add Note
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <Textarea
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setNewNote(''); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={!newNote.trim()}>
                Save Note
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className={`space-y-2 ${compact ? 'max-h-64 overflow-y-auto' : ''}`}>
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
        {[...notes].reverse().map((n) => (
          <Card key={n.note_id}>
            <CardContent className="p-3">
              <p className="text-sm">{n.note_text}</p>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <span>{getUserName(n.created_by_user_id)}</span>
                <span>•</span>
                <span>{format(new Date(n.created_at), 'dd MMM yyyy, HH:mm')}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
