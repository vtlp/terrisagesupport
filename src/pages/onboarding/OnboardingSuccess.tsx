import { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Download, Mail, Phone, X } from "lucide-react";

const TIMELINE_ITEMS = [
  "Workspace setup",
  "User login creation",
  "Project and brochure review",
  "Lead and property import assessment",
  "Mobile app readiness",
  "Training and support scheduling",
];

const BUILDER_TIMELINE = [
  "Workspace setup",
  "User login creation",
  "Brochure and project review",
  "Lead import assessment",
  "Mobile app readiness",
  "Training and support scheduling",
];

export default function OnboardingSuccess() {
  const location = useLocation();
  const isBuilder = location.pathname.includes("builder");
  const timeline = isBuilder ? BUILDER_TIMELINE : TIMELINE_ITEMS;
  const [showContact, setShowContact] = useState(false);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl w-full text-center space-y-8 py-16"
      >
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Check className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            Thank you. Your {isBuilder ? "builder" : "agency"} onboarding details have been received.
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Our team will now review your submission and begin preparing your Terrisage CRM setup.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 text-left space-y-4 max-w-md mx-auto">
          <h2 className="text-base font-semibold text-foreground">What happens next</h2>
          <ol className="space-y-3">
            {timeline.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground">{item}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-sm text-muted-foreground">
          If we need any clarification, we will contact your primary account owner.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            className="gap-2"
            onClick={async () => {
              const summary = takeOnboardingSummary();
              if (!summary) {
                toast.error("Summary is no longer available. Please reopen the form to download again.");
                return;
              }
              try {
                await downloadOnboardingZip(summary);
              } catch {
                toast.error("Could not generate the ZIP. Please try again.");
              }
            }}
          >
            <Download className="w-4 h-4" />
            Download submission summary
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowContact(!showContact)}>
            <Mail className="w-4 h-4" />
            Contact support
          </Button>
        </div>

        {showContact && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-lg p-5 max-w-sm mx-auto text-left space-y-3 relative"
          >
            <button onClick={() => setShowContact(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold text-foreground">Get in touch</h3>
            <a href="mailto:contact@terrisage.com" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Mail className="w-4 h-4" />
              contact@terrisage.com
            </a>
            <a href="tel:+919000720111" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Phone className="w-4 h-4" />
              +91 9000 720 111
            </a>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
