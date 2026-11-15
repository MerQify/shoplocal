import type { ComponentPropsWithoutRef } from "react";
import { buttonClass } from "@/lib/form-classes";

/**
 * The shared submit and action control primitive (#656, #1608).
 *
 * Server component ONLY — no `"use client"` here or anywhere in
 * `components/ui/`. It renders a plain `<button>`; nothing about it requires
 * a client boundary, so a form using it stays a real progressive-enhancement
 * `<form action={...}>` that works with no JavaScript.
 *
 * `variant="action"` (the default) IS `buttonClass` from `lib/form-classes.ts`
 * — composed, not re-declared (R7) — the small pill submit control already
 * shared by `BrandManager.tsx` and `DeliveryAreaManager.tsx`.
 *
 * `variant="primary"` is the larger `bg-primary` call-to-action shape used at
 * the foot of the catalogue's bigger forms (`ProductForm.tsx`,
 * `CategoryForm.tsx`, `CampaignForm.tsx`).
 *
 * Extended variants (#1608):
 * - `secondary`: neutral surface for cancel, dismiss, and auxiliary actions.
 * - `outline`: bordered control inheriting vendor action theme.
 * - `danger`: destructive actions (remove, delete, cancel order).
 * - `ghost`: subtle borderless button with hover highlight.
 *
 * Standard sizing scale (#1608):
 * - `sm`: 32px height (h-8), compact inline actions.
 * - `md`: 40px height (h-10), standard form and page actions.
 * - `lg`: 48px height (h-12), high-salience hero CTA buttons.
 * - `tap`: 44px height (h-tap), accessible mobile touch target.
 */

const FOCUS_RING_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2";

const PRIMARY_CLASS =
  "flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold " +
  "text-white shadow-md transition active:scale-95 motion-reduce:active:scale-100 " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  FOCUS_RING_CLASS;

const SECONDARY_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-black/15 bg-surface-muted " +
  "px-4 py-2 text-sm font-semibold text-black/85 transition hover:bg-black/5 " +
  "active:scale-95 motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-60 " +
  FOCUS_RING_CLASS;

const OUTLINE_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-action bg-white " +
  "px-4 py-2 text-sm font-semibold text-action transition hover:bg-action-tint " +
  "active:scale-95 motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-60 " +
  FOCUS_RING_CLASS;

const DANGER_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2 text-sm font-semibold " +
  "text-white shadow-xs transition hover:opacity-90 active:scale-95 motion-reduce:active:scale-100 " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  FOCUS_RING_CLASS;

const GHOST_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold " +
  "text-primary transition hover:bg-surface-muted active:scale-95 motion-reduce:active:scale-100 " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  FOCUS_RING_CLASS;

const VARIANT_CLASS = {
  action: buttonClass,
  primary: PRIMARY_CLASS,
  secondary: SECONDARY_CLASS,
  outline: OUTLINE_CLASS,
  danger: DANGER_CLASS,
  ghost: GHOST_CLASS,
} as const;

export type ButtonVariant = keyof typeof VARIANT_CLASS;
export type ButtonSize = "sm" | "md" | "lg" | "tap";

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  tap: "min-h-tap min-w-tap px-4 text-sm",
};

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "className">;

export function Button({
  variant = "action",
  size,
  className,
  type = "submit",
  ...rest
}: ButtonProps) {
  const sizeClasses = size ? SIZE_CLASS[size] : "";
  const classes = [VARIANT_CLASS[variant], sizeClasses, className].filter(Boolean).join(" ");

  return <button type={type} className={classes} {...rest} />;
}
