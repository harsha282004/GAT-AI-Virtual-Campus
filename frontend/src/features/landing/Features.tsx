"use client";

import { Camera, Languages, MapIcon, MessageSquare, Mic } from "lucide-react";

import { FeatureCard, SectionTitle } from "@/components/ui";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "AI Chat Assistant",
    description:
      "Ask questions about admissions, academics, or facilities and get answers grounded in GAT's own knowledge base.",
    accent: "purple" as const,
  },
  {
    icon: Camera,
    title: "360° Virtual Tour",
    description:
      "Walk through campus panorama by panorama, Street-View style, starting from the Main Gate.",
    accent: "orange" as const,
  },
  {
    icon: MapIcon,
    title: "3D Campus Map",
    description:
      "See the whole ~10-acre campus from above, with buildings and pathways rendered in interactive 3D.",
    accent: "green" as const,
  },
  {
    icon: Mic,
    title: "Voice Navigation",
    description:
      '"Take me to the library" — speak your destination and let the assistant guide the way.',
    accent: "pink" as const,
  },
  {
    icon: Languages,
    title: "Multi-language Support",
    description: "Interact in English, Kannada, or Hindi as the platform expands.",
    accent: "gold" as const,
  },
];

export function Features() {
  return (
    <section className="section-padding">
      <div className="container-page">
        <SectionTitle
          eyebrow="Platform"
          title="Everything you need to explore GAT"
          subtitle="One connected platform for prospective students, parents, and visitors to understand the campus before ever setting foot on it."
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.title} index={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
