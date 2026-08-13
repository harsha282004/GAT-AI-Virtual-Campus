"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/utils";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Campus", href: "/campus" },
  { label: "Virtual Tour", href: "/tour" },
  { label: "3D Map", href: "/map" },
  { label: "AI Assistant", href: "/chat" },
  { label: "About", href: "/#why-choose-gat" },
];

export function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="fixed inset-x-0 top-5 z-50 flex justify-center px-6">
      <motion.nav
        animate={{
          height: scrolled ? 68 : 78,
          boxShadow: scrolled
            ? "0 18px 45px rgba(15,23,42,0.14)"
            : "0 12px 35px rgba(15,23,42,0.08)",
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex w-full max-w-[1350px] items-center justify-between rounded-full border border-white/40 bg-white/82 px-7 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-black/30"
      >
        {/* Logo */}

        <Link href="/" className="flex items-center">
          <Image
            src="/images/gat_logo.jpeg"
            alt="GAT Logo"
            width={256}
            height={256}
            priority
            className="h-16 w-16 object-contain transition-all duration-300"
          />
        </Link>

        {/* Desktop Menu */}

        <div className="hidden items-center gap-1 xl:flex">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative px-4 py-2 text-[15px] font-medium text-slate-600 transition-colors duration-300 hover:text-[#2E4DB7] dark:text-slate-300 dark:hover:text-[#5B8CFF]",
                  active && "text-[#2E4DB7] dark:text-[#5B8CFF]",
                )}
              >
                <span className="relative z-10">{link.label}</span>

                {active && (
                  <motion.span
                    layoutId="navbar-lamp"
                    className="absolute inset-0 -z-0 rounded-full bg-[#2E4DB7]/10 dark:bg-[#5B8CFF]/10"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  >
                    <span className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-[#2E4DB7] dark:bg-[#5B8CFF]">
                      <span className="absolute -top-2 left-1/2 h-6 w-12 -translate-x-1/2 rounded-full bg-[#2E4DB7]/30 blur-md dark:bg-[#5B8CFF]/30" />
                    </span>
                  </motion.span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Right Side */}

        <div className="flex items-center gap-2">
          <motion.button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            whileTap={{ scale: 0.9 }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-[#2E4DB7]/10 dark:text-slate-300 dark:hover:bg-[#5B8CFF]/10"
          >
            <motion.span
              animate={{ rotate: mounted && resolvedTheme === "dark" ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              {mounted && resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </motion.span>
          </motion.button>

          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
            aria-expanded={isOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 xl:hidden"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu */}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="absolute top-[90px] w-[92%] rounded-3xl bg-white/95 p-4 shadow-xl backdrop-blur-xl xl:hidden dark:bg-slate-900/95 dark:shadow-black/30"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "rounded-xl px-5 py-3 text-[15px] font-medium transition-colors",
                    isActive(link.href)
                      ? "bg-[#2E4DB7]/10 text-[#2E4DB7] dark:bg-[#5B8CFF]/10 dark:text-[#5B8CFF]"
                      : "text-slate-700 hover:bg-[#2E4DB7]/5 dark:text-slate-300 dark:hover:bg-[#5B8CFF]/10",
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
