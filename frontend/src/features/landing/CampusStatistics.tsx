"use client";

import { useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { SectionTitle } from "@/components/ui";

const STATS = [
  { value: 2001, prefix: "Est. ", suffix: "", label: "Year Established" },
  { value: 10, prefix: "", suffix: "+ Acres", label: "Campus Area" },
  { value: 6, prefix: "", suffix: "", label: "Engineering Departments" },
  { value: 450, prefix: "", suffix: "-Seat", label: "Main Auditorium" },
];

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const duration = 1200;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    }

    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isInView, value]);

  return <span ref={ref}>{display.toLocaleString()}</span>;
}

export function CampusStatistics() {
  return (
    <section className="section-padding bg-gat-navy">
      <div className="container-page">
        <SectionTitle
          eyebrow="At a Glance"
          title="GAT by the numbers"
          light
          subtitle="A snapshot of the campus this platform is built to represent."
        />
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center"
            >
              <p className="font-display text-3xl font-bold text-gat-gold-light sm:text-4xl">
                {stat.prefix}
                <CountUp value={stat.value} />
                {stat.suffix}
              </p>
              <p className="mt-2 text-sm text-white/60">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
