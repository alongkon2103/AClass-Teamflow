import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { defaultRouteFor } from "@/lib/permissions";

// The root route has no UI of its own: send each role to its landing page.
export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? defaultRouteFor(user.role as Role) : "/login");
}
