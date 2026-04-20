import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Trash2, Eye, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLookup } from '@/hooks/useLookups';
import {
  CONTACT_TYPES, type ContactType, type MarketingContact, type ContactAttachment,
  createContact, updateContact, uploadContactAttachment, deleteAttachmentFile,
} from '@/lib/marketingApi';
import { FilePreviewDialog, previewIcon } from '@/components/shared/FilePreviewDialog';

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ path: string; name: string; mime: string | null } | null>(null);

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
      setPendingFiles([]);
    }
  }, [open, contact]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    if (!contact) {
      // Queue for upload after contact is created
      setPendingFiles(prev => [...prev, file]);
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
    } finally { setBusy(false); }
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

  const removePending = (idx: number) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

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
        const created = await createContact(payload);
        // Upload any queued files
        if (pendingFiles.length > 0) {
          const uploaded: ContactAttachment[] = [];
          for (const f of pendingFiles) {
            try { uploaded.push(await uploadContactAttachment(created.id, f)); }
            catch (err) { toast({ title: `Upload failed: ${f.name}`, description: (err as Error).message, variant: 'destructive' }); }
          }
          if (uploaded.length > 0) {
            await updateContact(created.id, { attachments: uploaded });
          }
        }
        toast({ title: 'Contact created' });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Save failed', description: (err as Error).message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <>
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
                {attachments.length === 0 && pendingFiles.length === 0 && (
                  <p className="text-xs text-muted-foreground">No attachments yet.</p>
                )}
                {/* Already-saved attachments */}
                {attachments.map(a => (
                  <div key={a.path} className="flex items-center justify-between text-sm bg-muted/40 px-2 py-1 rounded">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {previewIcon(a.mime, a.name)}
                      <span className="truncate">{a.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPreview({ path: a.path, name: a.name, mime: a.mime })} className="p-1 hover:text-primary" title="Preview"><Eye className="h-3.5 w-3.5" /></button>
                      <button onClick={() => removeAttachment(a.path)} className="p-1 hover:text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
                {/* Pending files (queued before contact creation) */}
                {pendingFiles.map((f, i) => (
                  <div key={`p-${i}`} className="flex items-center justify-between text-sm bg-info/10 px-2 py-1 rounded">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {previewIcon(f.type, f.name)}
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">queued</span>
                    </div>
                    <button onClick={() => removePending(i)} className="p-1 hover:text-destructive" title="Remove"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-primary">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>{contact ? 'Add file' : 'Attach file (uploaded on save)'}</span>
                  <input type="file" hidden disabled={busy} onChange={handleFile} />
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
      <FilePreviewDialog
        open={!!preview}
        onOpenChange={(o) => { if (!o) setPreview(null); }}
        bucket="contact-attachments"
        path={preview?.path ?? null}
        name={preview?.name ?? null}
        mime={preview?.mime ?? null}
      />
    </>
  );
}
