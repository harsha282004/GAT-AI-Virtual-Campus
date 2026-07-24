"use client";

import { motion } from "framer-motion";
import { ArrowRight, Bot, Layers, Mic, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { SectionTitle } from "@/components/ui";

const AI_CAPABILITIES = [
  {
    icon: Bot,
    title: "Grounded, cited answers",
    description: "Every answer is retrieved from GAT's real knowledge base — never guessed.",
  },
  {
    icon: Layers,
    title: "Specialist multi-agent routing",
    description: "Admissions, Academics, Facilities, and Navigation agents each handle their domain.",
  },
  {
    icon: Mic,
    title: "Voice-driven",
    description: '"Take me to the library" works by voice, not just typing.',
  },
  {
    icon: ShieldCheck,
    title: "Honest about its limits",
    description: "If it isn't in the knowledge base, the assistant says so instead of making it up.",
  },
];

export function AIFeatures() {
  return (
    <section className="section-padding">
      <div className="container-page">
        <SectionTitle
          eyebrow="Coming to Life"
          title="An AI assistant built for this campus"
          subtitle="The chat interface is live today — the grounded answers behind it are arriving across upcoming phases."
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {AI_CAPABILITIES.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="glass rounded-3xl p-7 shadow-soft transition-shadow duration-300 hover:shadow-glow"
            >
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-purple/12 text-accent-purple">
                <item.icon className="h-6 w-6" strokeWidth={1.6} />
              </span>
              <p className="font-display font-semibold text-ink">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition-colors hover:text-brand-dark"
          >
            Try the assistant interface
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
