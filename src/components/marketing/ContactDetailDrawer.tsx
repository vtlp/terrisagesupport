import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { type MarketingContact, deleteContact } from '@/lib/marketingApi';
import { DetailDrawer } from './DetailDrawer';
import { FilePreviewDialog, previewIcon } from '@/components/shared/FilePreviewDialog';

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
  const [preview, setPreview] = useState<{ path: string; name: string; mime: string | null } | null>(null);

  if (!contact) return null;

  const remove = async () => {
    if (!confirm('Delete this contact?')) return;
    try { await deleteContact(contact.id); toast({ title: 'Deleted' }); onChanged(); onOpenChange(false); }
    catch (e) { toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  const attachments = contact.attachments ?? [];

  return (
    <>
      <DetailDrawer
        open={open} onOpenChange={onOpenChange}
        title={contact.name}
        subtitle={`Added ${new Date(contact.created_at).toLocaleDateString()}`}
        badge={{ label: contact.contact_type }}
        sections={[
          {
            title: 'Contact details',
            rows: [
              { label: 'Contact type', value: contact.contact_type },
              { label: 'Title', value: contact.title },
              { label: 'Company', value: contact.company },
              { label: 'Email', value: contact.email },
              { label: 'Phone', value: contact.phone },
              { label: 'City', value: contact.city },
            ],
          },
          {
            title: `Attachments (${attachments.length})`,
            rows: attachments.length === 0
              ? [{ label: 'Files', value: <span className="text-muted-foreground">None</span> }]
              : attachments.map(a => ({
                  label: '',
                  value: (
                    <div className="flex items-center gap-2 w-full justify-end">
                      {previewIcon(a.mime, a.name)}
                      <span className="truncate max-w-[200px] text-sm">{a.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setPreview({ path: a.path, name: a.name, mime: a.mime })}
                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ),
                })),
          },
        ]}
        notes={contact.notes}
        footer={isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(contact)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={remove}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
          </div>
        )}
      />
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
