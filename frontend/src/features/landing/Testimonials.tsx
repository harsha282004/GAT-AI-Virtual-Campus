"use client";

import { motion } from "framer-motion";
import { Quote, User } from "lucide-react";

import { Card, SectionTitle } from "@/components/ui";

const TESTIMONIALS = [
  {
    quote:
      "The labs and faculty support in the CSE department gave me the confidence to take on real projects, not just coursework.",
    name: "Final Year Student",
    department: "Computer Science & Engineering",
  },
  {
    quote:
      "Being able to explore the campus and departments online before choosing my branch would have made my decision so much easier.",
    name: "Second Year Student",
    department: "Electronics & Communication",
  },
  {
    quote:
      "The hostel facilities and the central location made settling into campus life straightforward from day one.",
    name: "Third Year Student",
    department: "Mechanical Engineering",
  },
];

export function Testimonials() {
  return (
    <section className="section-padding bg-white dark:bg-gat-navy">
      <div className="container-page">
        <SectionTitle
          eyebrow="Student Voices"
          title="What life at GAT looks like"
          subtitle="Representative reflections from students across departments."
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial, index) => (
            <motion.div
              key={testimonial.name + testimonial.department}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
            >
              <Card className="flex h-full flex-col">
                <Quote className="h-6 w-6 text-gat-gold" />
                <p className="mt-4 flex-1 text-sm leading-relaxed text-gat-navy/80 dark:text-white/80">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-3 border-t border-gat-navy/10 pt-4 dark:border-white/10">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gat-navy/10 text-gat-navy dark:bg-white/10 dark:text-white">
                    <User className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gat-navy dark:text-white">
                      {testimonial.name}
                    </p>
                    <p className="text-xs text-gat-navy/60 dark:text-white/60">
                      {testimonial.department}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
