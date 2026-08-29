"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Reads a one-shot query parameter — the id carried by a notification link —
 * and strips it from the URL once claimed.
 *
 * Removing it matters: without that, a refresh or a back-navigation would
 * re-open the same dialog the user had just dismissed. Other parameters on the
 * URL (the board's `user`, say) are left alone.
 */
export function useDeepLinkParam(name: string): string | null {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const value = params.get(name);
  const [claimed, setClaimed] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    setClaimed(value);

    const next = new URLSearchParams(params.toString());
    next.delete(name);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [value, name, params, pathname, router]);

  return claimed;
}
