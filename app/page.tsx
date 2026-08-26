import { redirect } from "next/navigation";

// The root route has no UI of its own; auth + role routing takes over in Phase 2.
export default function RootPage() {
  redirect("/login");
}
