import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Plus, Mic, MicOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { Note } from '@/types/core';
import { getUserName } from '@/data/seedData';
import { toast } from 'sonner';

interface NotesPanelProps {
  notes: Note[];
  onAddNote?: (text: string) => void;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  autoFocus?: boolean;
}

const PAGE_SIZE = 5;

export function NotesPanel({ notes, onAddNote, compact = false, open, onOpenChange }: NotesPanelProps) {
  const [newNote, setNewNote] = useState('');
  const [internalShow, setInternalShow] = useState(false);
  const showForm = open ?? internalShow;
  const setShowForm = (v: boolean) => { onOpenChange?.(v); setInternalShow(v); };
  const [isListening, setIsListening] = useState(false);
  const [page, setPage] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const handleAdd = () => {
    if (newNote.trim() && onAddNote) {
      onAddNote(newNote.trim());
      setNewNote('');
      setShowForm(false);
      setPage(0);
    }
  };

  const toggleVoice = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast.error('Voice-to-text is not supported in this browser');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setNewNote(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast.error('Voice recognition error. Please try again.');
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    if (!showForm) setShowForm(true);
  };

  const sortedNotes = [...notes].reverse();
  const totalPages = Math.max(1, Math.ceil(sortedNotes.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageNotes = sortedNotes.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

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
            <div className="relative">
              <Textarea
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleVoice}
                className={`absolute top-1.5 right-1.5 h-7 w-7 ${isListening ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`}
                title={isListening ? 'Stop listening' : 'Voice to text'}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setNewNote(''); if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); } }}>
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
        {sortedNotes.length === 0 && (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
        {pageNotes.map((n) => (
          <Card key={n.note_id}>
            <CardContent className="p-3">
              <p className="text-sm whitespace-pre-wrap">{n.note_text}</p>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <span>{getUserName(n.created_by_user_id)}</span>
                <span>•</span>
                <span>{format(new Date(n.created_at), 'dd MMM yyyy, HH:mm')}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            Page {safePage + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
