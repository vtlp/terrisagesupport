import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { type MarketingContact, getAttachmentSignedUrl, deleteContact } from '@/lib/marketingApi';

interface Props {
  contact: MarketingContact | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: (c: MarketingContact) => void;
  onChanged: () => void;
  isAdmin: boolean;
}

export function ContactDetailDrawer({ contact, open, onOpenChange, onEdit, onChanged, isAdmin }: Props) {
  const { toast } = useToast();
  if (!contact) return null;

  const open_attachment = async (path: string) => {
    try { window.open(await getAttachmentSignedUrl(path), '_blank'); }
    catch (e) { toast({ title: 'Cannot open', description: (e as Error).message, variant: 'destructive' }); }
  };

  const remove = async () => {
    if (!confirm('Delete this contact?')) return;
    try { await deleteContact(contact.id); toast({ title: 'Deleted' }); onChanged(); onOpenChange(false); }
    catch (e) { toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>{contact.name}</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4">
          <Badge variant="secondary">{contact.contact_type}</Badge>

          <div className="space-y-2 text-sm">
            <Row label="Email" value={contact.email} />
            <Row label="Phone" value={contact.phone} />
            <Row label="City" value={contact.city} />
            <Row label="Created" value={new Date(contact.created_at).toLocaleDateString()} />
          </div>

          {contact.notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Attachments ({contact.attachments?.length ?? 0})</p>
            <div className="space-y-1">
              {(contact.attachments ?? []).map(a => (
                <button key={a.path} onClick={() => open_attachment(a.path)} className="flex items-center gap-2 w-full text-left text-sm bg-muted/40 hover:bg-muted px-2 py-1 rounded">
                  <Download className="h-3.5 w-3.5" /> <span className="truncate flex-1">{a.name}</span>
                </button>
              ))}
              {(!contact.attachments || contact.attachments.length === 0) && <p className="text-xs text-muted-foreground">None</p>}
            </div>
          </div>

          {isAdmin && (
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => onEdit(contact)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={remove}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value || '—'}</span>
    </div>
  );
}
