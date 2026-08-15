"use client";

import { ArrowUp, Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Twitter } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const QUICK_LINKS = [
  { label: "Campus Overview", href: "/campus" },
  { label: "Virtual Tour", href: "/tour" },
  { label: "3D Campus Map", href: "/map" },
  { label: "AI Assistant", href: "/chat" },
];

const PROGRAMS = [
  "Computer Science (CSE)",
  "Information Science (ISE)",
  "Electronics (ECE)",
  "Electrical (EEE)",
  "Mechanical (ME)",
  "Civil (CE)",
];

const SOCIAL_LINKS = [
  { label: "Facebook", icon: Facebook },
  { label: "Twitter", icon: Twitter },
  { label: "Instagram", icon: Instagram },
  { label: "LinkedIn", icon: Linkedin },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-[#16213E] text-white/75">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#5B8CFF]/60 to-transparent" />

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className="group absolute -top-6 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow transition-transform duration-300 hover:-translate-y-1"
      >
        <ArrowUp className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
      </button>

      <div className="container-page grid grid-cols-1 gap-10 px-6 pb-16 pt-20 sm:px-10 lg:grid-cols-4 lg:px-16">
        <div>
          <div className="mb-4 flex items-center gap-2.5">
            <Image
              src="/images/gat_logo.jpeg"
              alt="Global Academy of Technology"
              width={40}
              height={40}
              className="shrink-0 rounded-md object-contain"
            />
            <span className="font-display text-sm font-bold text-white">
              Global Academy of Technology
            </span>
          </div>
          <p className="text-sm leading-relaxed text-white/55">
            Growing Ahead Of Time — a VTU-affiliated engineering college established in 2001,
            NAAC A grade and AICTE approved.
          </p>
          <div className="mt-5 flex gap-2">
            {SOCIAL_LINKS.map(({ label, icon: Icon }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/60 transition-colors hover:bg-brand/25 hover:text-white"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Explore
          </h4>
          <ul className="space-y-2.5 text-sm">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-block text-white/65 transition-all duration-200 hover:translate-x-1 hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Departments
          </h4>
          <ul className="space-y-2.5 text-sm text-white/65">
            {PROGRAMS.map((program) => (
              <li key={program}>{program}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Contact
          </h4>
          <ul className="space-y-3 text-sm text-white/65">
            <li className="flex gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-white/40" />
              <span>Rajarajeshwari Nagar, Bangalore, Karnataka</span>
            </li>
            <li className="flex gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-white/40" />
              <span>Campus buses from Majestic, Shivajinagar, Kengeri, Jayanagar</span>
            </li>
            <li className="flex gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-white/40" />
              <span>admissions@gat.ac.in</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-white/40 sm:flex-row sm:px-10 lg:px-16">
          <p>© {year} Global Academy of Technology. All rights reserved.</p>
          <p>Built as an AI Agent-Based Indoor Virtual Campus Tour project.</p>
        </div>
      </div>
    </footer>
  );
}
