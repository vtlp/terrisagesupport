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
import { createRecord, updateRecord, type MarketingEvent } from '@/lib/marketingApi';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  existing?: MarketingEvent | null;
}

interface NominatimResult { display_name: string; place_id: number }
interface UserOption { id: string; full_name: string; email: string }

/** "ABC Hotel, MG Road, Bengaluru, …" → "ABC Hotel" */
const shortPlaceName = (s: string | null | undefined) => (s ?? '').split(',')[0].trim();

export function AddEventDialog({ open, onOpenChange, onSaved, existing }: Props) {
  const { toast } = useToast();
  const cities = useLookup('cities');
  const isEdit = !!existing;

  const [eventName, setEventName] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');         // full address — DB value
  const [locationQuery, setLocationQuery] = useState(''); // input field — short name only
  const [locResults, setLocResults] = useState<NominatimResult[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [extraAttendees, setExtraAttendees] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const debounce = useRef<number>();

  // Hydrate fields when opening (create vs edit)
  useEffect(() => {
    if (!open) return;
    if (existing) {
      setEventName(existing.event_name);
      setCity(existing.city ?? '');
      setLocation(existing.location ?? '');
      setLocationQuery(shortPlaceName(existing.location));
      setEventDate(existing.event_date ?? '');
      setExtraAttendees(String(existing.attendees ?? 0));
      setNotes(existing.notes ?? '');
      setSelectedUserIds([]); // team selection only applies to fresh creates
    } else {
      setEventName(''); setCity(''); setLocation(''); setLocationQuery('');
      setEventDate(''); setExtraAttendees('0'); setNotes(''); setSelectedUserIds([]);
    }
    setLocResults([]);
  }, [open, existing]);

  useEffect(() => {
    if (!open) return;
    supabase.from('profiles').select('id, full_name, email').eq('is_active', true).order('full_name')
      .then(({ data }) => setUsers((data ?? []) as UserOption[]));
  }, [open]);

  // Nominatim search debounced (city-scoped if chosen). Skip when query equals already-selected short name.
  useEffect(() => {
    const q = locationQuery.trim();
    if (!q || q.length < 3 || (location && q === shortPlaceName(location))) {
      setLocResults([]);
      return;
    }
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      setLocLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=in&q=${encodeURIComponent(`${q}${city ? ', ' + city : ''}, India`)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        setLocResults(await res.json() as NominatimResult[]);
      } catch { setLocResults([]); }
      finally { setLocLoading(false); }
    }, 350);
    return () => window.clearTimeout(debounce.current);
  }, [locationQuery, city, location]);

  const totalAttendees = useMemo(
    () => (isEdit ? Number(extraAttendees) || 0 : selectedUserIds.length + (Number(extraAttendees) || 0)),
    [selectedUserIds, extraAttendees, isEdit],
  );

  const submit = async () => {
    if (!eventName.trim()) { toast({ title: 'Event name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const selectedUsers = users.filter(u => selectedUserIds.includes(u.id));
      const payload = {
        event_name: eventName.trim(),
        city: city || null,
        location: location || null,
        event_date: eventDate || null,
        attendees: totalAttendees,
        notes: isEdit
          ? (notes.trim() || null)
          : ([notes.trim(), selectedUsers.length ? `Team attendees: ${selectedUsers.map(u => u.full_name).join(', ')}` : '']
              .filter(Boolean).join('\n\n') || null),
      };
      if (isEdit && existing) {
        await updateRecord('marketing_events', existing.id, payload);
        toast({ title: 'Event updated' });
      } else {
        await createRecord('marketing_events', payload);
        toast({ title: 'Event added' });
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast({ title: 'Failed to save', description: (e as Error).message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit event' : 'Add event'}</DialogTitle></DialogHeader>
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
            <div className="relative">
              <Input
                value={locationQuery}
                onChange={(e) => { setLocationQuery(e.target.value); setLocation(''); }}
                placeholder={city ? `Search venues in ${city}…` : 'Type at least 3 characters…'}
                autoComplete="off"
              />
              {(locLoading || locResults.length > 0) && locationQuery.length >= 3 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-60 overflow-auto">
                  {locLoading && (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching…
                    </div>
                  )}
                  {!locLoading && locResults.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground">No matches. Try a different query.</div>
                  )}
                  {!locLoading && locResults.map(r => (
                    <button
                      key={r.place_id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setLocation(r.display_name);                       // store full address in DB
                        setLocationQuery(shortPlaceName(r.display_name));  // show only main place
                        setLocResults([]);
                      }}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border last:border-0"
                    >
                      <p className="font-medium">{shortPlaceName(r.display_name)}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.display_name}</p>
                    </button>
                  ))}
                </div>
              )}
              {location && (
                <p className="text-xs text-muted-foreground mt-1 truncate" title={location}>
                  ✓ {shortPlaceName(location)}
                </p>
              )}
            </div>
          </div>

          {!isEdit && (
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
                        <Checkbox
                          checked={selectedUserIds.includes(u.id)}
                          onCheckedChange={() => setSelectedUserIds(prev => prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                        />
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
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{isEdit ? 'Total attendees' : 'Extra attendees (non-team)'}</Label>
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
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Add notes for this event…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add event')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
