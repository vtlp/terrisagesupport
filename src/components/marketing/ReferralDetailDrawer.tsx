import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteReferralRecord, type MarketingContact, type MarketingReferralRecord } from '@/lib/marketingApi';
import { DetailDrawer } from './DetailDrawer';

interface Props {
  record: MarketingReferralRecord | null;
  contact: MarketingContact | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
  onEdit?: (r: MarketingReferralRecord) => void;
  onOpenContact?: (c: MarketingContact) => void;
  isAdmin: boolean;
}

export function ReferralDetailDrawer({ record, contact, open, onOpenChange, onChanged, onEdit, onOpenContact, isAdmin }: Props) {
  const { toast } = useToast();
  if (!record) return null;

  const total = record.seats_referred * Number(record.price_per_seat) * (Number(record.commission_pct) / 100);

  const remove = async () => {
    if (!confirm('Delete this referral?')) return;
    try { await deleteReferralRecord(record.id); toast({ title: 'Deleted' }); onChanged(); onOpenChange(false); }
    catch (e) { toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' }); }
  };

  return (
    <DetailDrawer
      open={open} onOpenChange={onOpenChange}
      title={contact?.name ?? 'Referral'}
      subtitle={`Referred on ${new Date(record.referral_date).toLocaleDateString()}`}
      badge={{ label: record.status }}
      sections={[
        {
          title: 'Referrer',
          rows: [
            {
              label: 'Name',
              value: contact ? (
                <button onClick={() => onOpenContact?.(contact)} className="text-primary hover:underline inline-flex items-center gap-1">
                  {contact.name} <ExternalLink className="h-3 w-3" />
                </button>
              ) : '—',
            },
            { label: 'Type', value: contact?.contact_type },
            { label: 'Email', value: contact?.email },
            { label: 'Phone', value: contact?.phone },
          ],
        },
        {
          title: 'Commission',
          rows: [
            { label: 'Seats referred', value: record.seats_referred },
            { label: 'Price / seat', value: `₹${Number(record.price_per_seat).toLocaleString()}` },
            { label: 'Commission %', value: `${record.commission_pct}%` },
            {
              label: 'Total commission',
              value: <span className="font-semibold">₹{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>,
            },
          ],
        },
      ]}
      notes={record.notes}
      footer={isAdmin && (
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(record)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />Edit
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-destructive" onClick={remove}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
          </Button>
        </div>
      )}
    />
  );
}
