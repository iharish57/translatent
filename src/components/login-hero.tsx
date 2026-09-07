import { Languages, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

function TranslationChip({
  arabic,
  english,
  className,
}: {
  arabic: string;
  english: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-fit items-center gap-3 rounded-xl bg-card px-4 py-2.5 shadow-lg",
        className
      )}
    >
      <span dir="rtl" className="text-sm font-medium text-foreground">
        {arabic}
      </span>
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{english}</span>
    </div>
  );
}

/** The login page's only hero — a compact banner on mobile/tablet (stacked
 * above the form), and a full-height side panel on desktop (next to it). */
export function LoginHero() {
  return (
    <div className="relative flex w-full flex-col overflow-hidden bg-primary p-6 sm:p-8 lg:w-1/2 lg:justify-between lg:p-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-white/10 lg:-top-16 lg:-right-16 lg:size-64"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-14 -left-8 size-44 rounded-full bg-black/10 lg:-bottom-24 lg:-left-10 lg:size-72"
      />

      <div className="relative z-10">
        <div className="flex items-center gap-2 text-primary-foreground/80">
          <Languages className="size-5" />
          <span className="text-sm font-semibold tracking-wide uppercase">Translatent</span>
        </div>
        <h2 className="mt-4 max-w-md text-2xl leading-tight font-bold text-primary-foreground sm:text-3xl lg:mt-10 lg:text-4xl">
          Read any Arabic document in seconds.
        </h2>
        <p className="mt-3 max-w-sm text-sm text-primary-foreground/80 lg:mt-4 lg:text-base">
          Type text or upload a scan — even handwriting and poor photocopies — and get an
          accurate English translation with a confidence score, saved to your own history.
        </p>
      </div>

      <div className="relative z-10 mt-5 flex flex-wrap gap-2.5 lg:mt-12 lg:flex-col lg:flex-nowrap lg:gap-3">
        <TranslationChip arabic="مرحبا" english="Hello" />
        <TranslationChip arabic="شكرا جزيلا" english="Thank you very much" className="lg:ml-8" />
        <TranslationChip arabic="كيف حالك؟" english="How are you?" className="lg:ml-4" />
      </div>
    </div>
  );
}
