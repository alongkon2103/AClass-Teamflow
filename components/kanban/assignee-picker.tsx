"use client";

import { Check, Users } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { cn } from "@/lib/utils";
import type { MemberOption } from "./types";

/**
 * Picks any number of people for one task. A plain toggle list rather than a
 * multi-select: with a handful of teammates it is faster, shows avatars, and
 * stays usable by keyboard without a custom listbox.
 */
export function AssigneePicker({
  members,
  value,
  onChange,
}: {
  members: MemberOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((item) => item !== id) : [...value, id],
    );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-muted-foreground mb-2 text-xs font-semibold">
        ผู้รับผิดชอบ
        <span className="ml-1 font-normal">
          {value.length > 0
            ? `· เลือกแล้ว ${value.length} คน`
            : "· เลือกได้หลายคน"}
        </span>
      </legend>

      {members.length === 0 ? (
        <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <Users size={15} strokeWidth={2} />
          ยังไม่มีสมาชิกให้เลือก
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {members.map((member) => {
            const selected = value.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggle(member.id)}
                aria-pressed={selected}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border py-1.5 pr-3 pl-1.5 text-xs font-semibold transition-colors duration-150",
                  selected
                    ? "border-primary bg-primary-soft text-primary-ink"
                    : "border-line text-muted-foreground hover:bg-hover",
                )}
              >
                <Avatar user={member} size={22} />
                {member.name}
                {selected ? (
                  <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
