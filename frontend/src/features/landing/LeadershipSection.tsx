"use client";

import { motion } from "framer-motion";
import Image from "next/image";

import { SectionTitle } from "@/components/ui";

// Intrinsic pixel dimensions of each existing image (frontend/public/images/) —
// required by next/image to preserve each image's own aspect ratio. The
// photo, quote, name, and designation are already baked into the PNG
// itself, so this component never renders any of that as separate text.
const LEADERSHIP_IMAGES = [
  { src: "/images/leadership1.png", width: 1542, height: 566, alt: "Message from GAT leadership" },
  { src: "/images/leadership2.png", width: 1506, height: 431, alt: "Message from GAT leadership" },
  { src: "/images/leadership3.png", width: 1546, height: 581, alt: "Message from GAT leadership" },
  { src: "/images/leadership4.png", width: 1520, height: 588, alt: "Message from GAT leadership" },
];

export function LeadershipSection() {
  return (
    <section className="section-padding">
      <div className="container-page">
        <SectionTitle eyebrow="Leadership" title="A Message from Our Leadership" />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
          {LEADERSHIP_IMAGES.map((image, index) => (
            <motion.div
              key={image.src}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="flex items-center justify-center overflow-hidden rounded-3xl border border-hairline bg-white shadow-soft dark:bg-[#0F172A] dark:shadow-black/30"
            >
              <Image
                src={image.src}
                width={image.width}
                height={image.height}
                alt={image.alt}
                sizes="(min-width: 640px) 50vw, 100vw"
                className="h-auto w-full object-contain"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
