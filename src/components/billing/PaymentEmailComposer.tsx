// Shared payment-email composer used by both the enquiry initial-payment flow
// and the account renewal flow. It drafts an editable British-English email
// (subject + body) and offers two manual actions — copy to clipboard or open
// in the OS mail client via mailto:. The Console intentionally does not send
// email itself; this matches the existing "no auto-send" pattern.
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Mail, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';

export type EmailPurpose = 'INITIAL' | 'RENEWAL';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  purpose: EmailPurpose;
  to: string;
  defaultSubject: string;
  defaultBody: string;
  onDrafted?: (subject: string, body: string) => void;
  onMarkedSent?: (subject: string, body: string) => void;
}

export function PaymentEmailComposer({
  open, onOpenChange, purpose, to, defaultSubject, defaultBody, onDrafted, onMarkedSent,
}: Props) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [recipient, setRecipient] = useState(to);

  useEffect(() => {
    if (open) {
      setSubject(defaultSubject);
      setBody(defaultBody);
      setRecipient(to);
    }
  }, [open, defaultSubject, defaultBody, to]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    toast.success('Email copied to clipboard');
    onDrafted?.(subject, body);
  };

  const handleOpenMail = () => {
    if (!recipient.trim()) {
      toast.error('Recipient email is required');
      return;
    }
    const url = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    onDrafted?.(subject, body);
  };

  const handleMarkSent = () => {
    onMarkedSent?.(subject, body);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-4 gap-3">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            {purpose === 'INITIAL' ? 'Draft payment email' : 'Draft renewal email'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input className="h-8" type="email" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="account.owner@example.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Input className="h-8" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Body</Label>
            <Textarea rows={12} value={body} onChange={e => setBody(e.target.value)} className="font-mono text-xs leading-relaxed" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            The Console does not send email. Copy the draft into your mail client, or open it directly via your default mail app, then mark it as sent here.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
          </Button>
          <Button size="sm" variant="outline" onClick={handleOpenMail}>
            <Mail className="h-3.5 w-3.5 mr-1.5" /> Open in mail client
          </Button>
          <Button size="sm" onClick={handleMarkSent}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> Mark as sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Build the British-English initial payment email template. */
export function buildInitialPaymentEmail(opts: {
  ownerName: string;
  planName: string;
  seats: number;
  amount: number;
  currency: string;
  paymentLinkUrl: string;
  expiresAt?: string | null;
}) {
  const dueLine = opts.expiresAt
    ? `Due by: ${new Date(opts.expiresAt).toLocaleString('en-GB', { dateStyle: 'medium' })}`
    : '';
  const subject = 'Payment link for your Terrisage account';
  const body = [
    `Hello ${opts.ownerName || 'there'},`,
    '',
    'Thank you for choosing Terrisage.',
    '',
    `Please use the payment link below to complete your payment for ${opts.planName}.`,
    '',
    `Seats: ${opts.seats}`,
    `Amount: ${opts.currency} ${opts.amount.toLocaleString('en-IN')}`,
    `Payment link: ${opts.paymentLinkUrl}`,
    dueLine,
    '',
    'Once payment is received, we will proceed with the next step for your account setup.',
    '',
    'If you need any help, please reply to this email.',
    '',
    'Regards,',
    'Terrisage Support',
  ].filter(Boolean).join('\n');
  return { subject, body };
}

/** Build the British-English renewal payment email template. */
export function buildRenewalPaymentEmail(opts: {
  ownerName: string;
  planName: string;
  seats: number;
  amount: number;
  currency: string;
  paymentLinkUrl: string;
  dueDate?: string | null;
}) {
  const dueLine = opts.dueDate
    ? `Due by: ${new Date(opts.dueDate).toLocaleString('en-GB', { dateStyle: 'medium' })}`
    : '';
  const subject = 'Renewal payment link for your Terrisage account';
  const body = [
    `Hello ${opts.ownerName || 'there'},`,
    '',
    'Your Terrisage subscription is due for renewal.',
    '',
    'Please use the payment link below to complete your renewal payment.',
    '',
    `Seats: ${opts.seats}`,
    `Amount: ${opts.currency} ${opts.amount.toLocaleString('en-IN')}`,
    `Payment link: ${opts.paymentLinkUrl}`,
    dueLine,
    '',
    'Once payment is received, your subscription will continue for the next billing period.',
    '',
    'If you need any help, please reply to this email.',
    '',
    'Regards,',
    'Terrisage Support',
  ].filter(Boolean).join('\n');
  return { subject, body };
}
