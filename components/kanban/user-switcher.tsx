"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import type { MemberOption } from "./types";

/** Leader-only board switcher. The selection lives in the URL so it is shareable. */
export function UserSwitcher({
  members,
  value,
}: {
  members: MemberOption[];
  value: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const onChange = (next: string) => {
    const query = new URLSearchParams(params.toString());
    if (next) query.set("user", next);
    else query.delete("user");
    router.push(`/board?${query.toString()}`);
  };

  return (
    <label className="flex items-center gap-2">
      <span className="text-muted-foreground inline-flex items-center gap-2 text-[13px] font-semibold">
        <Users size={16} strokeWidth={2} />
        มุมมองผู้ใช้
      </span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="bg-input-bg border-line text-ink h-10 rounded-xl border px-3 text-[13px] font-semibold"
      >
        <option value="">ทุกคน</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
            {member.jobTitle ? ` · ${member.jobTitle}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
