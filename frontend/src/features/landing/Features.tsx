"use client";

import { Camera, Languages, MapIcon, MessageSquare, Mic } from "lucide-react";

import { FeatureCard, SectionTitle } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { useLanguageStore } from "@/store/languageStore";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "AI Chat Assistant",
    description:
      "Ask questions about admissions, academics, or facilities and get answers grounded in GAT's own knowledge base.",
    accent: "purple" as const,
    href: "/chat",
  },
  {
    icon: Camera,
    title: "360° Virtual Tour",
    description:
      "Walk through campus panorama by panorama, Street-View style, starting from the Main Gate.",
    accent: "orange" as const,
    href: "/tour",
  },
  {
    icon: MapIcon,
    title: "3D Campus Map",
    description:
      "See the whole ~10-acre campus from above, with buildings and pathways rendered in interactive 3D.",
    accent: "green" as const,
    href: "/map",
  },
  {
    icon: Mic,
    title: "Voice Navigation",
    description:
      '"Take me to the library" — speak your destination and let the assistant guide the way.',
    accent: "pink" as const,
    // No dedicated voice-navigation destination exists yet — the chat
    // page's mic button is itself disabled ("Voice input arrives in a
    // future phase"), so this card stays informational rather than
    // linking to a feature that isn't actually there yet.
  },
  {
    icon: Languages,
    title: "Multi-language Support",
    description: "Interact in English, Kannada, or Hindi as the platform expands.",
    accent: "gold" as const,
    // No dedicated page — clicking opens the navbar's Language dropdown
    // (see FeatureCard's `onClick` prop and useOnClick below).
  },
];

export function Features() {
  const { t } = useTranslation();
  const openPicker = useLanguageStore((state) => state.openPicker);

  function handleLanguageCardClick() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    openPicker();
  }

  return (
    <section className="section-padding">
      <div className="container-page">
        <SectionTitle
          eyebrow={t("Platform")}
          title={t("Everything you need to explore GAT")}
          subtitle={t(
            "One connected platform for prospective students, parents, and visitors to understand the campus before ever setting foot on it.",
          )}
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const isLanguageCard = feature.title === "Multi-language Support";
            return (
              <FeatureCard
                key={feature.title}
                index={index}
                icon={feature.icon}
                title={t(feature.title)}
                description={t(feature.description)}
                accent={feature.accent}
                href={feature.href}
                onClick={isLanguageCard ? handleLanguageCardClick : undefined}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
