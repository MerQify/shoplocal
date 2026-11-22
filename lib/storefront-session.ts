import { timeStorefrontRender } from "@/lib/storefront-render-timing";
import { cache } from "react";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

// Share the session read within a single server render. React discards it between requests.
export const getStorefrontSession = cache(async () => {
  const requestHeaders = await headers();
  const auth = await timeStorefrontRender("session.construct", getAuth);
  return timeStorefrontRender("session.read", () =>
    auth.api.getSession({ headers: requestHeaders }),
  );
});
