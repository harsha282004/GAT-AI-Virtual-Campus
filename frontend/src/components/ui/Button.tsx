"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { forwardRef, useState } from "react";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";

import { cn } from "@/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

type ButtonAsButton = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonAsLink = BaseProps & {
  href: string;
  children?: ReactNode;
  className?: string;
  target?: string;
  rel?: string;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white shadow-soft hover:bg-brand-dark hover:-translate-y-0.5 hover:shadow-glow focus-visible:ring-brand",
  secondary:
    "border-2 border-brand bg-white text-brand hover:-translate-y-0.5 hover:bg-brand hover:text-white hover:shadow-soft focus-visible:ring-brand",
  outline:
    "border border-hairline bg-white text-ink hover:border-brand/30 hover:bg-brand/5 focus-visible:ring-brand",
  ghost: "text-ink hover:bg-brand/5 focus-visible:ring-brand",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm gap-1.5",
  md: "px-6 py-3 text-sm gap-2",
  lg: "px-8 py-4 text-base gap-2.5",
};

const BASE_STYLES =
  "relative isolate inline-flex items-center justify-center overflow-hidden rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

let rippleCounter = 0;

function useRipples() {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  function spawnRipple(event: MouseEvent<HTMLElement>) {
    const target = event.currentTarget.getBoundingClientRect();
    const size = Math.max(target.width, target.height) * 2;
    rippleCounter += 1;
    const ripple: Ripple = {
      id: rippleCounter,
      x: event.clientX - target.left - size / 2,
      y: event.clientY - target.top - size / 2,
      size,
    };
    setRipples((prev) => [...prev, ripple]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
    }, 600);
  }

  const layer = (
    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ opacity: 0.35, scale: 0 }}
            animate={{ opacity: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute rounded-full bg-white/50"
            style={{ left: ripple.x, top: ripple.y, width: ripple.size, height: ripple.size }}
          />
        ))}
      </AnimatePresence>
    </span>
  );

  return { spawnRipple, layer };
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const {
    variant = "primary",
    size = "md",
    icon,
    iconPosition = "left",
    fullWidth = false,
    className,
    children,
    ...rest
  } = props;

  const { spawnRipple, layer } = useRipples();

  const classes = cn(
    BASE_STYLES,
    VARIANT_STYLES[variant],
    SIZE_STYLES[size],
    fullWidth && "w-full",
    className,
  );

  const content = (
    <>
      {layer}
      {icon && iconPosition === "left" && <span className="relative shrink-0">{icon}</span>}
      <span className="relative">{children}</span>
      {icon && iconPosition === "right" && <span className="relative shrink-0">{icon}</span>}
    </>
  );

  if ("href" in props && props.href) {
    const { href, target, rel } = props;
    return (
      <Link href={href} target={target} rel={rel} className={classes} onClick={spawnRipple}>
        {content}
      </Link>
    );
  }

  const { onClick, ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button
      ref={ref}
      className={classes}
      onClick={(event) => {
        spawnRipple(event);
        onClick?.(event);
      }}
      {...buttonRest}
    >
      {content}
    </button>
  );
});

Button.displayName = "Button";
