import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  number: number;
}

interface StepperNavProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
}

export function StepperNav({ steps, currentStep, completedSteps, onStepClick }: StepperNavProps) {
  return (
    <nav className="w-full bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <ol className="flex items-center justify-between py-4 gap-2">
          {steps.map((step, idx) => {
            const isCompleted = completedSteps.includes(step.number);
            const isCurrent = currentStep === step.number;
            const isClickable = isCompleted || step.number < currentStep;

            return (
              <li key={step.number} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(step.number)}
                  className={cn(
                    "flex items-center gap-2 sm:gap-3 group transition-colors",
                    isClickable ? "cursor-pointer" : "cursor-default"
                  )}
                  disabled={!isClickable && !isCurrent}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full text-sm font-semibold shrink-0 transition-all",
                      isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/20",
                      isCompleted && !isCurrent && "bg-primary text-primary-foreground",
                      !isCurrent && !isCompleted && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted && !isCurrent ? <Check className="w-4 h-4" /> : step.number}
                  </span>
                  <span
                    className={cn(
                      "hidden sm:block text-sm font-medium transition-colors",
                      isCurrent && "text-foreground",
                      isCompleted && !isCurrent && "text-foreground",
                      !isCurrent && !isCompleted && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </button>
                {idx < steps.length - 1 && (
                  <div className={cn("flex-1 h-px mx-2 sm:mx-4", isCompleted ? "bg-primary" : "bg-border")} />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
