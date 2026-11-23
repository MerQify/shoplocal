import manifest from "./lucide-icons-in-use.json";

// The migration manifest is a historical snapshot. Register later additions here.
export const lucideRegistryExports = new Map<string, string>([
  ...manifest.icons.map(({ key, export: name }): [string, string] => [key, name]),
  ["favourite-heart", "Heart"],
  ["shopping-basket", "ShoppingBasket"],
  ["item-unavailable", "PackageX"],
  ["timed-slot", "CalendarClock"],
  ["secure-payment", "ShieldCheck"],
  ["status-warning", "CircleAlert"],
  ["status-confirmed", "CircleCheck"],
  ["status-pending", "Clock"],
  ["status-cancelled", "CircleX"],
]);
