import { cache } from "react";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

// Share the session read within a single server render. React discards it between requests.
export const getStorefrontSession = cache(async () => {
  const requestHeaders = await headers();
  return (await getAuth()).api.getSession({ headers: requestHeaders });
});
