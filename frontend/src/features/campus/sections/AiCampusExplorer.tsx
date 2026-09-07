"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BookOpen, Compass, ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SectionTitle } from "@/components/ui";
import { useCampusScenes, useTranslation, type CampusExplorerState } from "@/hooks";
import { cn } from "@/utils";

import { deriveCampusActions } from "../data/contextualActions";

const SUGGESTED = [
  "Where is the Machine Learning lab?",
  "Tell me about the ISE department",
  "When does a GAT semester begin?",
  "Where is the auditorium?",
  "What computing labs does CSE have?",
  "How do I contact the admissions office?",
];

export function AiCampusExplorer({ explorer }: { explorer: CampusExplorerState }) {
  const { t } = useTranslation();
  const { resolveNode } = useCampusScenes();
  const [input, setInput] = useState("");

  const { submitted, response, errorMessage, isLoading, ask } = explorer;

  function submit(question: string) {
    ask(question);
    setInput("");
  }

  const actions =
    submitted && response ? deriveCampusActions(submitted, response, resolveNode) : [];

  const isRefusal =
    response?.status === "low_confidence_refusal" ||
    response?.status === "clarification_needed";

  return (
    <section
      id="ai-explorer"
      className="section-padding relative overflow-hidden bg-[#0B1330] text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(600px circle at 20% 10%, rgba(91,140,255,0.28), transparent 55%), radial-gradient(700px circle at 85% 90%, rgba(35,68,212,0.3), transparent 55%)",
        }}
      />
      <div className="container-page relative">
        <SectionTitle
          eyebrow={t("AI Campus Explorer")}
          title={t("Ask anything about GAT")}
          subtitle={t(
            "The same grounded assistant that powers the AI Assistant page — it answers only from official GAT information and links you to the relevant place on campus.",
          )}
          className="[&_h2]:text-white [&_p]:text-white/70"
        />

        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) submit(input);
            }}
            className="glass flex items-center gap-2 rounded-2xl p-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("e.g. Where is the CSE department?")}
              className="flex-1 bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-muted"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-dark disabled:opacity-40"
              aria-label={t("Ask")}
            >
              {isLoading ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white"
                />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>
          </form>

          {!submitted && (
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => submit(q)}
                  className="rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 text-xs text-white/80 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white"
                >
                  {t(q)}
                </button>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {submitted && (
              <motion.div
                key={submitted}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6 space-y-4"
              >
                <p className="text-sm font-medium text-white/60">
                  <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
                  {submitted}
                </p>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <span className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                            className="h-1.5 w-1.5 rounded-full bg-white/70"
                          />
                        ))}
                      </span>
                      {t("Searching official GAT information…")}
                    </div>
                  ) : errorMessage ? (
                    <p className="text-sm text-red-300">{errorMessage}</p>
                  ) : response ? (
                    <>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                        {response.answer}
                      </p>
                      {response.confidence_level && !isRefusal && (
                        <p className="mt-3 text-[11px] uppercase tracking-wide text-white/40">
                          {t("Confidence")}: {response.confidence_level}
                        </p>
                      )}
                    </>
                  ) : null}
                </div>

                {actions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {actions.map((action, i) => {
                      const common =
                        "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white";
                      if (action.kind === "tour" && action.nodeId !== undefined) {
                        return (
                          <Link key={i} href={`/tour?scene=${action.nodeId}`} className={common}>
                            <Compass className="h-3.5 w-3.5" />
                            {action.label}
                          </Link>
                        );
                      }
                      const Icon = action.kind === "syllabus" ? BookOpen : ExternalLink;
                      return (
                        <a
                          key={i}
                          href={action.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(common, "max-w-[280px] truncate")}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{action.label}</span>
                        </a>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => explorer.reset()}
                  className="text-xs font-medium text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
                >
                  {t("Ask another question")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
