import { motion } from "framer-motion";

interface HeroSectionProps {
  title: string;
  subtitle: string;
  supportingText: string;
  preparationNote: string;
}

export function HeroSection({ title, subtitle, supportingText, preparationNote }: HeroSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8"
    >
      <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-3">{title}</h1>
      <p className="text-lg text-foreground/80 mb-2 max-w-2xl">{subtitle}</p>
      <p className="text-base text-muted-foreground mb-4 max-w-2xl">{supportingText}</p>
      <div className="bg-accent/15 border border-accent/30 rounded-lg px-4 py-3 text-sm text-foreground/70 max-w-2xl">
        💡 {preparationNote}
      </div>
    </motion.section>
  );
}
