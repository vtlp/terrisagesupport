import { Button } from "@/components/ui/button";
import { Save, ArrowLeft, ArrowRight, Send } from "lucide-react";

interface StickyActionBarProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onSaveDraft: () => void;
  onContinue: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
}

export function StickyActionBar({
  currentStep, totalSteps, onBack, onSaveDraft, onContinue, onSubmit, isSubmitting,
}: StickyActionBarProps) {
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="sticky bottom-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={currentStep === 1} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={onSaveDraft} className="gap-2 text-muted-foreground">
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Save draft</span>
          </Button>

          {isLastStep ? (
            <Button type="button" onClick={onSubmit} disabled={isSubmitting} className="gap-2">
              <Send className="w-4 h-4" />
              {isSubmitting ? "Submitting..." : "Submit onboarding details"}
            </Button>
          ) : (
            <Button type="button" onClick={onContinue} className="gap-2">
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
