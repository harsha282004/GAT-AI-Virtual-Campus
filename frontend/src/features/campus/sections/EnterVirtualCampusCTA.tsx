"use client";

import { motion } from "framer-motion";
import { Compass, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui";
import { useTranslation } from "@/hooks";

export function EnterVirtualCampusCTA() {
  const { t } = useTranslation();

  return (
    <section id="enter" className="relative overflow-hidden bg-brand-gradient py-24 text-white">
      <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="container-page relative flex flex-col items-center px-6 text-center"
      >
        <h2 className="max-w-2xl font-display text-3xl font-bold sm:text-4xl">
          {t("Enter the Virtual Campus")}
        </h2>
        <p className="mt-4 max-w-xl text-white/75">
          {t(
            "You've seen the map — now walk it. Step into the 360° tour of the Main Building, or ask the assistant to guide you.",
          )}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Button
            href="/tour"
            size="lg"
            variant="secondary"
            icon={<Compass className="h-5 w-5" />}
          >
            {t("Start Exploring")}
          </Button>
          <Button
            href="/chat"
            size="lg"
            variant="outline"
            icon={<MessageSquare className="h-5 w-5" />}
            className="border-white/40 bg-white/10 text-white hover:border-white hover:bg-white hover:text-brand"
          >
            {t("Open the AI Assistant")}
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
