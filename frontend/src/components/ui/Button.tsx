"use client";

import Link from "next/link";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

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
  primary:
    "bg-gat-maroon text-white hover:bg-gat-maroon-light shadow-sm hover:shadow-md focus-visible:ring-gat-maroon",
  secondary:
    "bg-gat-gold text-gat-navy-dark hover:bg-gat-gold-light shadow-sm hover:shadow-gold focus-visible:ring-gat-gold",
  outline:
    "border border-gat-navy/20 text-gat-navy hover:bg-gat-navy/5 dark:border-white/20 dark:text-white dark:hover:bg-white/10 focus-visible:ring-gat-navy",
  ghost:
    "text-gat-navy hover:bg-gat-navy/5 dark:text-white dark:hover:bg-white/10 focus-visible:ring-gat-navy",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm gap-1.5",
  md: "px-6 py-3 text-sm gap-2",
  lg: "px-8 py-4 text-base gap-2.5",
};

const BASE_STYLES =
  "inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

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

  const classes = cn(
    BASE_STYLES,
    VARIANT_STYLES[variant],
    SIZE_STYLES[size],
    fullWidth && "w-full",
    className,
  );

  const content = (
    <>
      {icon && iconPosition === "left" && <span className="shrink-0">{icon}</span>}
      {children}
      {icon && iconPosition === "right" && <span className="shrink-0">{icon}</span>}
    </>
  );

  if ("href" in props && props.href) {
    const { href, target, rel } = props;
    return (
      <Link href={href} target={target} rel={rel} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button ref={ref} className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
});

Button.displayName = "Button";
