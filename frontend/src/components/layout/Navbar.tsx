"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, Moon, Sun, X } from "lucide-react";
import Image from "next/image";
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
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav className="glass flex w-full max-w-6xl items-center justify-between rounded-full py-2.5 pl-3 pr-4 shadow-soft sm:pl-4 sm:pr-6">
        {/* Logo slot — drop the official GAT crest at public/branding/gat-logo.svg to replace this placeholder */}
        <Link href="/" className="flex shrink-0 items-center py-1" onClick={() => setIsOpen(false)}>
          <Image
            src="/branding/gat-logo.svg"
            alt="Global Academy of Technology"
            width={65}
            height={65}
            priority
            style={{ height: "65px", width: "auto" }}
          />
        </Link>

        <div className="hidden items-center gap-1 xl:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:text-brand",
                isActive(link.href) && "text-brand",
              )}
            >
              {link.label}
              {isActive(link.href) && (
                <motion.span
                  layoutId="nav-underline"
                  className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink/60 transition-colors hover:bg-brand/8 hover:text-brand"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          <button
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink/60 transition-colors hover:bg-brand/8 hover:text-brand xl:hidden"
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
            className="glass absolute inset-x-4 top-[4.75rem] rounded-3xl p-3 shadow-soft xl:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "bg-brand/10 text-brand"
                      : "text-ink/70 hover:bg-brand/5 hover:text-brand",
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
