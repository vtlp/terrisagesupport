import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Trash2, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLookup } from '@/hooks/useLookups';
import {
  CONTACT_TYPES, type ContactType, type MarketingContact, type ContactAttachment,
  createContact, updateContact, uploadContactAttachment, getAttachmentSignedUrl, deleteAttachmentFile,
} from '@/lib/marketingApi';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact: MarketingContact | null;
  onSaved: () => void;
}

export function ContactDialog({ open, onOpenChange, contact, onSaved }: Props) {
  const { toast } = useToast();
  const cities = useLookup('cities');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<ContactType>('Prospect Customer');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<ContactAttachment[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setTitle(contact?.title ?? '');
      setCompany(contact?.company ?? '');
      setEmail(contact?.email ?? '');
      setPhone(contact?.phone ?? '');
      setType(contact?.contact_type ?? 'Prospect Customer');
      setCity(contact?.city ?? '');
      setNotes(contact?.notes ?? '');
      setAttachments(contact?.attachments ?? []);
    }
  }, [open, contact]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!contact) {
      toast({ title: 'Save contact first', description: 'Create the contact, then add attachments.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const att = await uploadContactAttachment(contact.id, file);
      const next = [...attachments, att];
      setAttachments(next);
      await updateContact(contact.id, { attachments: next });
      toast({ title: 'Attachment uploaded' });
    } catch (err) {
      toast({ title: 'Upload failed', description: (err as Error).message, variant: 'destructive' });
    } finally { setBusy(false); e.target.value = ''; }
  };

  const removeAttachment = async (path: string) => {
    if (!contact) return;
    setBusy(true);
    try {
      await deleteAttachmentFile(path);
      const next = attachments.filter(a => a.path !== path);
      setAttachments(next);
      await updateContact(contact.id, { attachments: next });
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const downloadAttachment = async (path: string) => {
    try {
      const url = await getAttachmentSignedUrl(path);
      window.open(url, '_blank');
    } catch (err) {
      toast({ title: 'Cannot open', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const save = async () => {
    if (!name.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const payload = {
        name,
        title: title || null,
        company: company || null,
        email: email || null,
        phone: phone || null,
        contact_type: type,
        city: city || null,
        notes: notes || null,
      };
      if (contact) {
        await updateContact(contact.id, payload);
        toast({ title: 'Contact updated' });
      } else {
        await createContact(payload);
        toast({ title: 'Contact created' });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Save failed', description: (err as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{contact ? 'Edit contact' : 'Add contact'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Contact name *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Title / Designation</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Director, Founder" /></div>
            <div><Label>Company</Label><Input value={company} onChange={e => setCompany(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
          </div>
          <div>
            <Label>Contact type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ContactType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTACT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>City</Label>
            <Select value={city || 'NONE'} onValueChange={(v) => setCity(v === 'NONE' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">— None —</SelectItem>
                {cities.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>

          <div>
            <Label>Attachments</Label>
            <div className="border rounded-md p-2 space-y-2">
              {attachments.length === 0 && <p className="text-xs text-muted-foreground">No attachments yet.</p>}
              {attachments.map(a => (
                <div key={a.path} className="flex items-center justify-between text-sm bg-muted/40 px-2 py-1 rounded">
                  <span className="truncate flex-1">{a.name}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => downloadAttachment(a.path)} className="p-1 hover:text-primary" title="Open"><Download className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeAttachment(a.path)} className="p-1 hover:text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-primary">
                <Paperclip className="h-3.5 w-3.5" />
                <span>{contact ? 'Add file' : 'Save contact first to add files'}</span>
                <input type="file" hidden disabled={!contact || busy} onChange={handleFile} />
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
