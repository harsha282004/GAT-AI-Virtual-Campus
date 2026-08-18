"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote, User } from "lucide-react";
import { useEffect, useState } from "react";

import { SectionTitle } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/utils";

const TESTIMONIALS = [
  {
    quote:
      "The labs and faculty support in the CSE department gave me the confidence to take on real projects, not just coursework.",
    name: "Final Year Student",
    department: "Computer Science & Engineering",
  },
  {
    quote:
      "Being able to explore the campus and departments online before choosing my branch would have made my decision so much easier.",
    name: "Second Year Student",
    department: "Electronics & Communication",
  },
  {
    quote:
      "The hostel facilities and the central location made settling into campus life straightforward from day one.",
    name: "Third Year Student",
    department: "Mechanical Engineering",
  },
];

export function Testimonials() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  function go(delta: number) {
    setDirection(delta);
    setIndex((prev) => (prev + delta + TESTIMONIALS.length) % TESTIMONIALS.length);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const current = TESTIMONIALS[index];

  return (
    <section className="section-padding overflow-hidden">
      <div className="container-page">
        <SectionTitle
          eyebrow={t("Student Voices")}
          title={t("What life at GAT looks like")}
          subtitle={t("Representative reflections from students across departments.")}
        />

        <div
          className="relative mx-auto flex max-w-3xl items-center justify-center gap-4"
          role="region"
          aria-roledescription="carousel"
          aria-label="Student testimonials"
        >
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous testimonial"
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-white text-ink transition-colors hover:border-brand hover:text-brand dark:bg-[#0F172A] sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="relative min-h-[280px] w-full overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={index}
                custom={direction}
                initial={{ opacity: 0, x: direction >= 0 ? 60 : -60, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: direction >= 0 ? -60 : 60, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="glass flex flex-col items-center rounded-3xl p-10 text-center shadow-glow"
              >
                <Quote className="h-8 w-8 text-brand" />
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink/85">
                  &ldquo;{t(current.quote)}&rdquo;
                </p>
                <div className="mt-7 flex items-center gap-3 border-t border-hairline pt-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <User className="h-5 w-5" />
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-ink">{t(current.name)}</p>
                    <p className="text-xs text-muted">{t(current.department)}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next testimonial"
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-white text-ink transition-colors hover:border-brand hover:text-brand dark:bg-[#0F172A] sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2">
          {TESTIMONIALS.map((testimonial, i) => (
            <button
              key={testimonial.name}
              type="button"
              onClick={() => {
                setDirection(i > index ? 1 : -1);
                setIndex(i);
              }}
              aria-label={`Go to testimonial ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === index ? "w-8 bg-brand" : "w-2 bg-brand/20 hover:bg-brand/40",
              )}
            />
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-6 sm:hidden">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous testimonial"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-ink dark:bg-[#0F172A]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next testimonial"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-ink dark:bg-[#0F172A]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
