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
  { label: "Indoor Navigation", href: "/navigation" },
  { label: "3D Map", href: "/map" },
  { label: "AI Assistant", href: "/chat" },
  { label: "About", href: "/#why-choose-gat" },
];

export function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="fixed inset-x-0 top-5 z-50 flex justify-center px-6">

      <nav
        className="
        flex
        h-[78px]
        w-full
        max-w-[1350px]
        items-center
        justify-between
        rounded-full
        border
        border-white/40
        bg-white/82
        px-7
        shadow-xl
        backdrop-blur-xl
        dark:border-slate-700
        dark:bg-slate-900/80
        dark:shadow-black/30
      "
      >

        {/* Logo */}

        <Link href="/" className="flex items-center">

          <Image
  src="/images/gat_logo.jpeg"
  alt="GAT Logo"
  width={256}
  height={256}
  priority
  className="h-20 w-20 object-contain"
/>

        </Link>

        {/* Desktop Menu */}

        <div className="hidden items-center gap-7 xl:flex">

          {NAV_LINKS.map((link) => (

            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative text-[16px] font-medium text-slate-600 transition-all duration-300 hover:text-[#2E4DB7] dark:text-slate-300 dark:hover:text-[#5B8CFF]",
                isActive(link.href) && "text-[#2E4DB7] dark:text-[#5B8CFF]"
              )}
            >
              {link.label}

              {isActive(link.href) && (
                <motion.span
                  layoutId="underline"
                  className="absolute left-0 right-0 -bottom-2 mx-auto h-[2px] w-full rounded-full bg-[#2E4DB7] dark:bg-[#5B8CFF]"
                />
              )}
            </Link>

          ))}

        </div>

        {/* Right Side */}

        <div className="flex items-center gap-2">

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            text-slate-600
            transition
            hover:bg-[#2E4DB7]/10
            dark:text-slate-300
            dark:hover:bg-[#5B8CFF]/10
          "
          >
            {mounted && resolvedTheme === "dark" ? (
              <Sun size={18} />
            ) : (
              <Moon size={18} />
            )}
          </button>

          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
            className="
            xl:hidden
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            text-slate-600
            dark:text-slate-300
          "
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

        </div>

      </nav>

      {/* Mobile Menu */}

      <AnimatePresence>

        {isOpen && (

          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="
            absolute
            top-[90px]
            w-[92%]
            rounded-3xl
            bg-white/95
            p-4
            shadow-xl
            backdrop-blur-xl
            xl:hidden
            dark:bg-slate-900/95
            dark:shadow-black/30
          "
          >

            <div className="flex flex-col gap-2">

              {NAV_LINKS.map((link) => (

                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "rounded-xl px-5 py-3 text-[15px] font-medium transition",
                    isActive(link.href)
                      ? "bg-[#2E4DB7]/10 text-[#2E4DB7] dark:bg-[#5B8CFF]/10 dark:text-[#5B8CFF]"
                      : "text-slate-700 hover:bg-[#2E4DB7]/5 dark:text-slate-300 dark:hover:bg-[#5B8CFF]/10"
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