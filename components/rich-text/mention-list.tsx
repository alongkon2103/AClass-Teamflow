"use client";

import { Avatar } from "@/components/shared/avatar";
import { cn } from "@/lib/utils";

export type MentionCandidate = {
  id: string;
  name: string;
  jobTitle: string | null;
  avatarColor: string;
  avatarUrl: string | null;
};

/**
 * The @-suggestion popup. Purely presentational: the editor owns the selection
 * because the keys arrive at the editor, not here.
 */
export function MentionList({
  items,
  selected,
  onHover,
  onPick,
}: {
  items: MentionCandidate[];
  selected: number;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="border-line bg-surface shadow-lift text-muted-foreground rounded-xl border px-3 py-2 text-xs">
        ไม่พบสมาชิกที่ตรงกับที่พิมพ์
      </div>
    );
  }

  return (
    <ul className="border-line bg-surface shadow-lift max-h-56 w-56 overflow-y-auto rounded-xl border p-1">
      {items.map((item, index) => (
        <li key={item.id}>
          <button
            type="button"
            onMouseEnter={() => onHover(index)}
            // Keeping focus in the editor keeps the suggestion range alive.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(index)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left",
              index === selected ? "bg-primary-soft" : "hover:bg-hover",
            )}
          >
            <Avatar user={item} size={22} />
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold">
                {item.name}
              </span>
              {item.jobTitle ? (
                <span className="text-muted-foreground block truncate text-[10px]">
                  {item.jobTitle}
                </span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
