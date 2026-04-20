import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronsUpDown, Loader2 } from 'lucide-react';
import { useLookup } from '@/hooks/useLookups';
import { createRecord } from '@/lib/marketingApi';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

interface NominatimResult { display_name: string; place_id: number }
interface UserOption { id: string; full_name: string; email: string }

export function AddEventDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const cities = useLookup('cities');

  const [eventName, setEventName] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locResults, setLocResults] = useState<NominatimResult[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [extraAttendees, setExtraAttendees] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const debounce = useRef<number>();

  useEffect(() => {
    if (!open) return;
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true).order('full_name')
      .then(({ data }) => setUsers((data ?? []) as UserOption[]));
  }, [open]);

  // Nominatim search debounced (city-scoped if chosen)
  useEffect(() => {
    if (!locationQuery || locationQuery.length < 3) { setLocResults([]); return; }
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      setLocLoading(true);
      try {
        const q = encodeURIComponent(`${locationQuery}${city ? ', ' + city : ''}, India`);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=in&q=${q}`, {
          headers: { 'Accept-Language': 'en' },
        });
        const data = (await res.json()) as NominatimResult[];
        setLocResults(data);
      } catch { setLocResults([]); }
      finally { setLocLoading(false); }
    }, 350);
    return () => window.clearTimeout(debounce.current);
  }, [locationQuery, city]);

  const totalAttendees = useMemo(
    () => selectedUserIds.length + (Number(extraAttendees) || 0),
    [selectedUserIds, extraAttendees],
  );

  const reset = () => {
    setEventName(''); setCity(''); setLocation(''); setLocationQuery('');
    setLocResults([]); setEventDate(''); setSelectedUserIds([]);
    setExtraAttendees('0'); setNotes('');
  };

  const toggleUser = (id: string) =>
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const submit = async () => {
    if (!eventName.trim()) {
      toast({ title: 'Event name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const selectedUsers = users.filter(u => selectedUserIds.includes(u.id));
      await createRecord('marketing_events', {
        event_name: eventName.trim(),
        city: city || null,
        location: location || null,
        event_date: eventDate || null,
        attendees: totalAttendees,
        notes: [
          notes.trim(),
          selectedUsers.length ? `Team attendees: ${selectedUsers.map(u => u.full_name).join(', ')}` : '',
        ].filter(Boolean).join('\n\n') || null,
      });
      toast({ title: 'Event added' });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast({ title: 'Failed to add', description: (e as Error).message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add event</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Event name *</Label>
            <Input value={eventName} onChange={e => setEventName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City</Label>
              <Select value={city || 'none'} onValueChange={(v) => { setCity(v === 'none' ? '' : v); setLocation(''); setLocationQuery(''); }}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="none">—</SelectItem>
                  {cities.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Event date</Label>
              <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Location {city && <span className="text-muted-foreground text-xs">(in {city})</span>}</Label>
            <Popover open={locResults.length > 0 || locLoading}>
              <PopoverTrigger asChild>
                <Input
                  value={locationQuery || location}
                  onChange={(e) => { setLocationQuery(e.target.value); setLocation(''); }}
                  placeholder={city ? `Search venues in ${city}…` : 'Type at least 3 characters…'}
                />
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-card" align="start" onOpenAutoFocus={e => e.preventDefault()}>
                {locLoading && (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                  </div>
                )}
                {!locLoading && locResults.map(r => (
                  <button
                    key={r.place_id}
                    type="button"
                    onClick={() => { setLocation(r.display_name); setLocationQuery(r.display_name); setLocResults([]); }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border last:border-0"
                  >
                    {r.display_name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Attendees from team</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {selectedUserIds.length > 0 ? `${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''} selected` : 'Select team members'}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-card" align="start">
                <ScrollArea className="max-h-60">
                  {users.length === 0 && <p className="p-3 text-sm text-muted-foreground">No users found.</p>}
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer">
                      <Checkbox checked={selectedUserIds.includes(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.full_name || u.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </label>
                  ))}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Extra attendees (non-team)</Label>
              <Input type="number" min={0} value={extraAttendees} onChange={e => setExtraAttendees(e.target.value)} />
            </div>
            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{totalAttendees}</span>
              </div>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add event'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
