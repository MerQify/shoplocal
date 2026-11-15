import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * The canonical badge and tag surface primitive.
 *
 * Server component ONLY — no `"use client"` here or in `components/ui/`.
 * Renders a semantic pill `<span className="...">` with WCAG AA compliant contrast pairs,
 * standard 18px (`sm`) and 22px (`md`) control heights, and `rounded-full` pill geometry.
 */

export type BadgeVariant = "action" | "primary" | "accent" | "danger" | "muted" | "outline";
export type BadgeTone = "fill" | "tint";
export type BadgeSize = "sm" | "md";

const VARIANT_TONE_CLASS: Record<BadgeVariant, Record<BadgeTone, string>> = {
  action: {
    fill: "bg-action text-white shadow-xs",
    tint: "bg-action-tint text-action",
  },
  primary: {
    fill: "bg-primary text-white shadow-xs",
    tint: "bg-surface-muted text-primary",
  },
  accent: {
    fill: "bg-accent text-white shadow-xs",
    tint: "bg-accent-tint text-accent",
  },
  danger: {
    fill: "bg-danger text-white shadow-xs",
    tint: "bg-danger-tint text-danger",
  },
  muted: {
    fill: "bg-surface-muted text-primary-muted",
    tint: "bg-surface-muted text-primary-muted",
  },
  outline: {
    fill: "border border-black/15 bg-white text-black/80",
    tint: "border border-black/10 bg-white/90 text-black/70",
  },
};

const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: "text-[10px] font-semibold px-2 py-0.5 leading-none",
  md: "text-xs font-semibold px-2.5 py-0.5 leading-tight",
};

export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
  size?: BadgeSize;
  className?: string;
  children: ReactNode;
}

export function Badge({
  variant = "action",
  tone = "fill",
  size = "md",
  className,
  children,
  ...rest
}: BadgeProps) {
  const colorClasses = VARIANT_TONE_CLASS[variant][tone];
  const sizeClasses = SIZE_CLASS[size];
  const classes = [
    "inline-flex items-center gap-1 rounded-full whitespace-nowrap",
    colorClasses,
    sizeClasses,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
