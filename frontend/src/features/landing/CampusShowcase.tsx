"use client";

import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import Image from "next/image";

import { Button, SectionTitle } from "@/components/ui";

const CAMPUS_IMAGES = [
  { src: "/images/campus1.jpg", alt: "Global Academy of Technology campus view 1" },
  { src: "/images/campus2.jpeg", alt: "Global Academy of Technology campus view 2" },
  { src: "/images/campus3.jpg", alt: "Global Academy of Technology campus view 3" },
  { src: "/images/campus4.jpeg", alt: "Global Academy of Technology campus view 4" },
];

/** Replaces the old VirtualTourPreview section (placeholder "Coming
 * Soon" location tiles) with a real campus photo/video showcase — the
 * 6-tile placeholder grid served no purpose once Phase 5+ shipped the
 * actual Virtual Tour, and this project's "no fabricated coming-soon
 * content" discipline argued for replacing it rather than keeping it
 * around. */
export function CampusShowcase() {
  return (
    <section className="section-padding">
      <div className="container-page">
        <SectionTitle
          eyebrow="Campus Showcase"
          title="See GAT's campus for yourself"
          subtitle="A glimpse of the buildings and grounds you'll explore in the Virtual Tour and 3D map."
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
          {/* LEFT — 2x2 photo grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-2 gap-4"
          >
            {CAMPUS_IMAGES.map((image) => (
              <div
                key={image.src}
                className="group relative aspect-square overflow-hidden rounded-3xl shadow-soft"
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            ))}
          </motion.div>

          {/* RIGHT — campus video, boxed (not full-bleed like the hero) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative h-72 overflow-hidden rounded-3xl shadow-soft lg:h-auto lg:min-h-full"
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-center"
            >
              <source src="/videos/campus-2.mp4" type="video/mp4" />
            </video>
          </motion.div>
        </div>

        <div className="mt-12 flex justify-center">
          <Button href="/campus" variant="outline" icon={<Compass className="h-4 w-4" />}>
            Explore Campus
          </Button>
        </div>
      </div>
    </section>
  );
}
