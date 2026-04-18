import { motion } from "framer-motion";
import { CheckCircle2, Mail, Phone, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Props {
  submittedAt?: string | null;
  tenancy: "agency" | "builder";
}

const SUPPORT_EMAIL = "contact@terrisage.com";
const SUPPORT_PHONE = "+919000720111";

export function AlreadySubmittedScreen({ submittedAt, tenancy }: Props) {
  const [showContact, setShowContact] = useState(false);
  const formatted = submittedAt
    ? new Date(submittedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-xl w-full text-center space-y-6 py-16"
      >
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            This onboarding form has already been submitted
          </h1>
          <p className="text-base text-muted-foreground">
            If you need to correct or add information, request an updated link
            or contact Terrisage support.
          </p>
          {formatted && (
            <p className="text-sm text-muted-foreground">
              Submitted on <span className="font-medium text-foreground">{formatted}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            variant="default"
            className="gap-2"
            onClick={() =>
              (window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Request new onboarding link (${tenancy})`)
            }
          >
            <Link2 className="w-4 h-4" />
            Request new link
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowContact((v) => !v)}
          >
            <Mail className="w-4 h-4" />
            Contact support
          </Button>
        </div>

        {showContact && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-lg p-5 max-w-sm mx-auto text-left space-y-3"
          >
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Mail className="w-4 h-4" />
              {SUPPORT_EMAIL}
            </a>
            <a
              href={`tel:${SUPPORT_PHONE}`}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Phone className="w-4 h-4" />
              +91 9000 720 111
            </a>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
