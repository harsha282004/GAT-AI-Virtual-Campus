"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

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
    <section className="section-padding relative overflow-hidden bg-brand-gradient">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 80%, white 0, transparent 40%)",
        }}
      />
      <div className="container-page relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <span className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
            <span className="h-px w-6 bg-white/70" />
            At a Glance
          </span>
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            GAT by the numbers
          </h2>
          <p className="mt-6 text-base leading-relaxed text-white/70">
            A snapshot of the campus this platform is built to represent.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="rounded-3xl border border-white/15 bg-white/10 px-6 py-9 text-center backdrop-blur-sm"
            >
              <p className="font-display text-3xl font-bold text-white sm:text-4xl">
                {stat.prefix}
                <CountUp value={stat.value} />
                {stat.suffix}
              </p>
              <p className="mt-2 text-sm text-white/70">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
