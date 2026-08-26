"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Priority } from "@prisma/client";
import {
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  PRIORITY_META,
} from "@/lib/constants";

const SEARCH_DEBOUNCE_MS = 300;

type MemberOption = { id: string; name: string };

/**
 * Search and filters, mirrored into the URL so a filtered view can be shared
 * and survives a refresh (SPEC 5.2).
 */
export function TaskFilters({ members }: { members: MemberOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState(params.get("q") ?? "");
  const firstRender = useRef(true);

  const push = (mutate: (query: URLSearchParams) => void) => {
    const query = new URLSearchParams(params.toString());
    mutate(query);
    // Any filter change invalidates the current page number.
    query.delete("page");
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };

  // Debounce only the free-text field; the selects apply immediately.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      push((query) => {
        if (search.trim()) query.set("q", search.trim());
        else query.delete("q");
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `push` closes over params/pathname, which are stable per render here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const selectClass =
    "bg-input-bg border-line text-ink h-10 rounded-xl border px-3 text-[13px] font-semibold";

  const onSelect =
    (key: string) => (event: React.ChangeEvent<HTMLSelectElement>) =>
      push((query) => {
        if (event.target.value) query.set(key, event.target.value);
        else query.delete(key);
      });

  return (
    <div className="flex flex-wrap gap-2">
      <div className="bg-input-bg border-line flex items-center gap-2 rounded-xl border px-3">
        <Search size={15} strokeWidth={2} className="text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ค้นหาชื่องานหรือรายละเอียด"
          aria-label="ค้นหางาน"
          className="text-ink h-10 w-44 border-none bg-transparent text-[13px] outline-none"
        />
      </div>

      <select
        aria-label="กรองตามสมาชิก"
        className={selectClass}
        value={params.get("member") ?? ""}
        onChange={onSelect("member")}
      >
        <option value="">ทีมงานทุกคน</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>

      <select
        aria-label="กรองตามสถานะ"
        className={selectClass}
        value={params.get("status") ?? ""}
        onChange={onSelect("status")}
      >
        <option value="">ทุกสถานะ</option>
        {TASK_STATUS_ORDER.map((status) => (
          <option key={status} value={status}>
            {TASK_STATUS_META[status].label}
          </option>
        ))}
      </select>

      <select
        aria-label="กรองตามความสำคัญ"
        className={selectClass}
        value={params.get("priority") ?? ""}
        onChange={onSelect("priority")}
      >
        <option value="">ทุกระดับความสำคัญ</option>
        {[Priority.NORMAL, Priority.IMPORTANT, Priority.URGENT].map(
          (priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_META[priority].label}
            </option>
          ),
        )}
      </select>
    </div>
  );
}
