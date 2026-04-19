import { motion } from "framer-motion";
import { CheckCircle2, Mail, Phone, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Props {
  submittedAt?: string | null;
  tenancy: "agency" | "builder";
}

const SUPPORT_EMAIL = "contact@terrisage.com";
const SUPPORT_PHONE_TEL = "+919000720111";
const SUPPORT_PHONE_DISPLAY = "+91 9000 720 111";

export function AlreadySubmittedScreen({ submittedAt, tenancy }: Props) {
  const [showContact, setShowContact] = useState(false);
  const formatted = submittedAt
    ? new Date(submittedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  const subject = encodeURIComponent(`Request new onboarding link (${tenancy})`);

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
            To generate a new onboarding link or update your details, please contact Terrisage support using the details below.
          </p>
          {formatted && (
            <p className="text-sm text-muted-foreground">
              Submitted on <span className="font-medium text-foreground">{formatted}</span>
            </p>
          )}
        </div>

        <div className="flex justify-center pt-2">
          <Button
            variant="default"
            className="gap-2"
            onClick={() => setShowContact((v) => !v)}
          >
            <LifeBuoy className="w-4 h-4" />
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
              href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Mail className="w-4 h-4" />
              {SUPPORT_EMAIL}
            </a>
            <a
              href={`tel:${SUPPORT_PHONE_TEL}`}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Phone className="w-4 h-4" />
              {SUPPORT_PHONE_DISPLAY}
            </a>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
