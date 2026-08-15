"use client";

import { motion } from "framer-motion";
import Image from "next/image";

// Intrinsic pixel dimensions of each existing image (frontend/public/images/) —
// required by next/image to preserve each photo's own aspect ratio. Real
// campus photography, not placeholders — nothing here is generated.
const CAMPUS_IMAGES = [
  { src: "/images/1.png", width: 1080, height: 550 },
  { src: "/images/2.png", width: 1092, height: 537 },
  { src: "/images/3.png", width: 1018, height: 566 },
  { src: "/images/4.png", width: 1095, height: 547 },
  { src: "/images/5.png", width: 1100, height: 546 },
  { src: "/images/6.png", width: 1085, height: 535 },
  { src: "/images/7.png", width: 1027, height: 533 },
  { src: "/images/8.png", width: 1090, height: 542 },
  { src: "/images/9.png", width: 1087, height: 542 },
  { src: "/images/10.png", width: 1022, height: 577 },
  { src: "/images/11.png", width: 1085, height: 543 },
  { src: "/images/12.png", width: 1075, height: 545 },
  { src: "/images/13.png", width: 1016, height: 572 },
  { src: "/images/14.png", width: 1728, height: 932 },
  { src: "/images/15.jpg", width: 4096, height: 2731 },
  { src: "/images/16.jpeg", width: 800, height: 361 },
];

export function CampusGallery() {
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10">
      {CAMPUS_IMAGES.map((image, index) => (
        <motion.div
          key={image.src}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45, delay: (index % 2) * 0.08 }}
          className="group flex items-center justify-center overflow-hidden rounded-3xl border border-hairline bg-white shadow-soft transition-shadow duration-300 hover:shadow-glow dark:bg-[#0F172A] dark:shadow-black/30"
        >
          <Image
            src={image.src}
            width={image.width}
            height={image.height}
            alt={`Global Academy of Technology campus photo ${index + 1}`}
            sizes="(min-width: 640px) 50vw, 100vw"
            className="h-auto w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        </motion.div>
      ))}
    </div>
  );
}
