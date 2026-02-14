import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { EnquiryStage, EnquiryOutcome, NotInterestedReason } from '@/types/core';

const stageLabels: Record<EnquiryStage, string> = {
  [EnquiryStage.NEW_ENQUIRY]: 'New Enquiry',
  [EnquiryStage.CONTACTED]: 'Contacted',
  [EnquiryStage.DEMO_SCHEDULED]: 'Demo Scheduled',
  [EnquiryStage.DEMO_COMPLETED]: 'Demo Completed',
  [EnquiryStage.ACCOUNT_CREATED]: 'Account Created',
};

const outcomeLabels: Record<EnquiryOutcome, string> = {
  [EnquiryOutcome.INTERESTED]: 'Interested',
  [EnquiryOutcome.CALL_LATER]: 'Call Later',
  [EnquiryOutcome.SCHEDULE_DEMO]: 'Schedule Demo',
  [EnquiryOutcome.NOT_INTERESTED]: 'Not Interested',
  [EnquiryOutcome.WRONG_OR_BOUNCED_NUMBER]: 'Wrong / Bounced',
};

const niReasonLabels: Record<NotInterestedReason, string> = {
  [NotInterestedReason.OTHER_CRM_IN_USE]: 'Already using other CRM',
  [NotInterestedReason.NOT_RIGHT_PERSON]: 'Not right person',
  [NotInterestedReason.NOT_RIGHT_TIME]: 'Not right time',
  [NotInterestedReason.TOO_MANY_REQUIREMENTS]: 'Too expensive',
  [NotInterestedReason.BUDGET_CONCERN]: 'Need more features',
  [NotInterestedReason.OTHER]: 'Just browsing',
};

// Compatible outcomes per stage
const compatibleOutcomes: Record<EnquiryStage, EnquiryOutcome[]> = {
  [EnquiryStage.NEW_ENQUIRY]: [],
  [EnquiryStage.CONTACTED]: [
    EnquiryOutcome.INTERESTED,
    EnquiryOutcome.CALL_LATER,
    EnquiryOutcome.SCHEDULE_DEMO,
    EnquiryOutcome.NOT_INTERESTED,
    EnquiryOutcome.WRONG_OR_BOUNCED_NUMBER,
  ],
  [EnquiryStage.DEMO_SCHEDULED]: [EnquiryOutcome.SCHEDULE_DEMO],
  [EnquiryStage.DEMO_COMPLETED]: [
    EnquiryOutcome.INTERESTED,
    EnquiryOutcome.NOT_INTERESTED,
  ],
  [EnquiryStage.ACCOUNT_CREATED]: [],
};

// Outcomes that require mandatory notes
const requiresNote = new Set([
  EnquiryOutcome.NOT_INTERESTED,
  EnquiryOutcome.WRONG_OR_BOUNCED_NUMBER,
]);

interface StageChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetStage: EnquiryStage;
  currentOutcome: EnquiryOutcome | null;
  onConfirm: (outcome: EnquiryOutcome, note: string, niReason?: NotInterestedReason) => void;
}

export function StageChangeModal({
  open,
  onOpenChange,
  targetStage,
  currentOutcome,
  onConfirm,
}: StageChangeModalProps) {
  const outcomes = compatibleOutcomes[targetStage] ?? [];
  const [selected, setSelected] = useState<EnquiryOutcome | null>(
    currentOutcome && outcomes.includes(currentOutcome) ? currentOutcome : null
  );
  const [note, setNote] = useState('');
  const [niReason, setNiReason] = useState<NotInterestedReason | null>(null);

  const needsNote = selected ? requiresNote.has(selected) : false;
  const canConfirm = selected && (!needsNote || note.trim().length > 0);

  // Auto-select if only one option
  if (outcomes.length === 1 && !selected) {
    setSelected(outcomes[0]);
  }

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm(selected, note, niReason ?? undefined);
    setSelected(null);
    setNote('');
    setNiReason(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm stage change</DialogTitle>
          <DialogDescription>
            You are moving this enquiry to <strong>{stageLabels[targetStage]}</strong>. Please confirm the outcome.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Outcome quick buttons */}
          {outcomes.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Select outcome</Label>
              <div className="flex flex-wrap gap-2">
                {outcomes.map(o => (
                  <Badge
                    key={o}
                    variant={selected === o ? 'default' : 'outline'}
                    className="cursor-pointer text-xs px-3 py-1.5 transition-colors"
                    onClick={() => {
                      setSelected(o);
                      if (o !== EnquiryOutcome.NOT_INTERESTED) setNiReason(null);
                    }}
                  >
                    {outcomeLabels[o]}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Not interested reason chips */}
          {selected === EnquiryOutcome.NOT_INTERESTED && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Reason</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(niReasonLabels).map(([key, label]) => (
                  <Badge
                    key={key}
                    variant={niReason === key ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setNiReason(key as NotInterestedReason)}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes field */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Notes {needsNote && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              placeholder={needsNote ? 'A note is required for this outcome...' : 'Optional note...'}
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!canConfirm} onClick={handleConfirm}>
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
