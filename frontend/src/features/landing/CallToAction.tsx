"use client";

import { motion } from "framer-motion";
import { MessageSquare, Navigation as NavigationIcon } from "lucide-react";

import { Button } from "@/components/ui";

export function CallToAction() {
  return (
    <section className="relative overflow-hidden bg-brand-gradient py-24">
      <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="container-page relative flex flex-col items-center px-6 text-center sm:px-10 lg:px-16"
      >
        <h2 className="max-w-2xl font-display text-3xl font-bold text-white sm:text-4xl">
          Experience GAT like never before
        </h2>
        <p className="mt-4 max-w-xl text-white/75">
          From your first question to your last turn down a corridor — explore the campus your
          way.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Button href="/tour" size="lg" variant="secondary" icon={<NavigationIcon className="h-5 w-5" />}>
            Start the Virtual Tour
          </Button>
          <Button
            href="/chat"
            size="lg"
            variant="outline"
            className="border-white/30 bg-transparent text-white hover:border-white/50 hover:bg-white/10"
            icon={<MessageSquare className="h-5 w-5" />}
          >
            Chat with the Assistant
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
