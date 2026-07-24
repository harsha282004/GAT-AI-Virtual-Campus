"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Landmark, Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useThemeStore } from "@/store/themeStore";
import { cn } from "@/utils";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Campus", href: "/campus" },
  { label: "Virtual Tour", href: "/tour" },
  { label: "Indoor Navigation", href: "/navigation" },
  { label: "3D Map", href: "/map" },
  { label: "AI Assistant", href: "/chat" },
  { label: "About", href: "/#why-choose-gat" },
];

export function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const isActive = (href: string) => href !== "/" && href.startsWith("/") && pathname === href;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <nav className="glass-light mx-auto mt-3 flex w-[95%] max-w-7xl items-center justify-between rounded-2xl px-4 py-3 shadow-sm dark:bg-gat-navy/60 dark:border-white/10 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setIsOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gat-navy text-gat-gold">
            <Landmark className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="font-display text-sm font-bold leading-tight text-gat-navy dark:text-white sm:text-base">
            Global Academy
            <span className="block text-[11px] font-medium tracking-wide text-gat-maroon dark:text-gat-gold-light">
              of Technology
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-gat-navy text-white dark:bg-white dark:text-gat-navy"
                  : "text-gat-navy/70 hover:bg-gat-navy/5 hover:text-gat-navy dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gat-navy/70 transition-colors hover:bg-gat-navy/5 dark:text-white/70 dark:hover:bg-white/10"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          <button
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gat-navy/70 transition-colors hover:bg-gat-navy/5 dark:text-white/70 dark:hover:bg-white/10 lg:hidden"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="glass-light mx-auto mt-2 w-[95%] max-w-7xl rounded-2xl p-3 shadow-sm dark:bg-gat-navy/80 lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "bg-gat-navy text-white dark:bg-white dark:text-gat-navy"
                      : "text-gat-navy/70 hover:bg-gat-navy/5 dark:text-white/70 dark:hover:bg-white/10",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
