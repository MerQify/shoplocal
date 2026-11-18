import { Icon } from "@/components/icons/Icon";
import { isDiallablePhone, isEmailAddress, telHref } from "@/lib/footer-contact-form";

/**
 * #1656 — the "ask us about allergens" notice: a stopgap until products carry structured allergen
 * data (#1653). FSA guidance lets allergen information for non-prepacked food sold at a distance
 * be given by phone, provided the shopper is told how to get it before ordering; this is that
 * signpost.
 *
 * Shown only when the vendor ticks "Show allergen notice" (`VendorConfig.showAllergenNotice`), so
 * the caller decides whether to render it. The contact details are the vendor's own footer
 * contacts — never a literal here (CLAUDE.md, "User-facing copy"). With neither a phone nor an
 * email it still tells the shopper to ask before ordering.
 */
export function AllergenNotice({
  phone,
  email,
  className = "",
}: {
  phone: string | null;
  email: string | null;
  className?: string;
}) {
  const diallable = phone && isDiallablePhone(phone) ? phone : null;
  const mailable = email && isEmailAddress(email) ? email : null;

  return (
    <aside
      aria-label="Allergy information"
      className={`flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-tint px-4 py-3 text-sm text-primary ${className}`}
    >
      <Icon name="circle-alert" className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
      <div>
        <p className="font-bold">Allergy information</p>
        <p className="mt-0.5 text-primary-muted">
          If you have a food allergy or intolerance, ask us about allergens before you order
          {diallable || mailable ? ":" : "."}{" "}
          {diallable && (
            <a href={telHref(diallable)} className="font-semibold text-primary underline">
              {diallable}
            </a>
          )}
          {diallable && mailable && " or "}
          {mailable && (
            <a href={`mailto:${mailable}`} className="font-semibold text-primary underline">
              {mailable}
            </a>
          )}
        </p>
      </div>
    </aside>
  );
}
