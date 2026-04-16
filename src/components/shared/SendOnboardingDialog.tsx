import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Mail, MessageCircle, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface SendOnboardingDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  link: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
}

export function SendOnboardingDialog({
  open, onOpenChange, link, customerName, customerPhone, customerEmail,
}: SendOnboardingDialogProps) {
  const [copied, setCopied] = useState(false);

  const message = `Hi ${customerName}, please complete the Terrisage onboarding form here: ${link}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const sendEmail = () => {
    const subject = encodeURIComponent('Terrisage Onboarding Form');
    const body = encodeURIComponent(message);
    const to = customerEmail ?? '';
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_blank');
  };

  const sendWhatsApp = () => {
    const phone = (customerPhone ?? '').replace(/\D/g, '');
    const text = encodeURIComponent(message);
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Onboarding Form</DialogTitle>
          <DialogDescription>
            Share this link with {customerName}. They will fill it in and submit it back to you for review.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={link} readOnly className="text-xs" />
            <Button onClick={copyLink} size="icon" variant="outline">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={sendEmail} variant="outline" className="w-full">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button onClick={sendWhatsApp} variant="outline" className="w-full">
              <MessageCircle className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Email opens your default mail app. WhatsApp opens wa.me with the message prefilled.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
