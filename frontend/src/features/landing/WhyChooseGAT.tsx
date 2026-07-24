"use client";

import { motion } from "framer-motion";
import { Award, BadgeCheck, Building2, CheckCircle2, GraduationCap, Home, ShieldCheck } from "lucide-react";

import { SectionTitle } from "@/components/ui";

const REASONS = [
  { icon: BadgeCheck, text: "VTU-affiliated engineering programs (BE, MTech, MSc, MBA)" },
  { icon: Award, text: "NAAC A Grade accredited institution" },
  { icon: ShieldCheck, text: "AICTE approved and recognized" },
  { icon: Building2, text: "Modern labs and infrastructure across 6 departments" },
  { icon: GraduationCap, text: "Experienced faculty and dedicated placement support" },
  { icon: Home, text: "On-campus hostel with separate boys' and girls' blocks" },
];

export function WhyChooseGAT() {
  return (
    <section id="why-choose-gat" className="section-padding bg-white dark:bg-gat-navy">
      <div className="container-page grid grid-cols-1 gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionTitle
            eyebrow="About GAT"
            title="Why students choose Global Academy of Technology"
            align="left"
            className="mb-8"
          />
          <ul className="space-y-4">
            {REASONS.map((reason, index) => (
              <motion.li
                key={reason.text}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: index * 0.06 }}
                className="flex items-start gap-3"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gat-maroon/10 text-gat-maroon">
                  <reason.icon className="h-4 w-4" />
                </span>
                <span className="text-sm leading-relaxed text-gat-navy/80 dark:text-white/80">
                  {reason.text}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl bg-gat-hero p-10 text-white"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gat-gold/10 blur-2xl" />
          <CheckCircle2 className="h-10 w-10 text-gat-gold" strokeWidth={1.5} />
          <p className="mt-6 font-display text-2xl font-semibold">Growing Ahead Of Time</p>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Since 2001, GAT has trained engineers across Computer Science, Information Science,
            Electronics, Electrical, Mechanical, and Civil Engineering — with admission through
            KCET, COMEDK, PGCET, GATE, and KMAT.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
