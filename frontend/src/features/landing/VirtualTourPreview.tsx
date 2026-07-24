"use client";

import { motion } from "framer-motion";
import { Camera, DoorOpen } from "lucide-react";
import Link from "next/link";

import { Button, SectionTitle } from "@/components/ui";

const LOCATIONS = ["Main Gate", "Admin Block", "Library", "CSE Block", "Auditorium", "Sports Ground"];

export function VirtualTourPreview() {
  return (
    <section className="section-padding bg-white dark:bg-gat-navy">
      <div className="container-page">
        <SectionTitle
          eyebrow="360° Experience"
          title="Walk through campus, panorama by panorama"
          subtitle="Real Insta360 photography is being captured now — here's where each stop will begin."
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {LOCATIONS.map((location, index) => (
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
            >
              <Link
                href="/tour"
                className="group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gat-hero text-white shadow-sm transition-transform duration-300 hover:-translate-y-1"
              >
                <Camera className="h-6 w-6 text-gat-gold transition-transform duration-300 group-hover:scale-110" />
                <span className="px-2 text-center text-xs font-medium">{location}</span>
                <span className="absolute inset-x-0 bottom-0 bg-black/40 py-1 text-center text-[10px] uppercase tracking-wide text-white/70">
                  Coming Soon
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Button href="/tour" variant="outline" icon={<DoorOpen className="h-4 w-4" />}>
            Enter the Virtual Tour
          </Button>
        </div>
      </div>
    </section>
  );
}
