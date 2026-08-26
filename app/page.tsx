import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { defaultRouteFor } from "@/lib/permissions";

/**
 * The root has no UI: it sends each visitor to where they belong. Resolving the
 * role here avoids bouncing a signed-in user through /login and back, which
 * added two extra round trips to every sign-in.
 */
export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? defaultRouteFor(user.role) : "/login");
}
