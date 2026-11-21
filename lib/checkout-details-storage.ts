import { CHECKOUT_DETAILS_KEY, LEGACY_CHECKOUT_DETAILS_KEY } from "./storage-keys";

/** Delete checkout drafts from older releases without reading their contents. */
export function clearStoredCheckoutDetails(getStorage: () => Storage): void {
  try {
    const storage = getStorage();
    storage.removeItem(CHECKOUT_DETAILS_KEY);
    storage.removeItem(LEGACY_CHECKOUT_DETAILS_KEY);
  } catch {
    // Browsers that block access to storage should still be able to check out.
  }
}
