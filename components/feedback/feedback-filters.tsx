"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { FeedbackStatus } from "@prisma/client";
import { FEEDBACK_STATUS_META } from "@/lib/constants";
import type { GameOption } from "@/components/kanban/types";

const SEARCH_DEBOUNCE_MS = 300;

const STATUS_ORDER: FeedbackStatus[] = [
  FeedbackStatus.PENDING,
  FeedbackStatus.FIXING,
  FeedbackStatus.RESOLVED,
  FeedbackStatus.DISMISSED,
];

export function FeedbackFilters({ games }: { games: GameOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const firstRender = useRef(true);

  const push = (mutate: (query: URLSearchParams) => void) => {
    const query = new URLSearchParams(params.toString());
    mutate(query);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };

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
          placeholder="ค้นหาข้อความหรือ Ticket"
          aria-label="ค้นหาฟีดแบค"
          className="text-ink h-10 w-44 border-none bg-transparent text-[13px] outline-none"
        />
      </div>

      <select
        aria-label="กรองตามสถานะ"
        className={selectClass}
        value={params.get("status") ?? ""}
        onChange={onSelect("status")}
      >
        <option value="">ทุกสถานะ</option>
        {STATUS_ORDER.map((status) => (
          <option key={status} value={status}>
            {FEEDBACK_STATUS_META[status].label}
          </option>
        ))}
      </select>

      <select
        aria-label="กรองตามเกม"
        className={selectClass}
        value={params.get("game") ?? ""}
        onChange={onSelect("game")}
      >
        <option value="">ทุกเกม</option>
        {games.map((game) => (
          <option key={game.id} value={game.id}>
            {game.name}
          </option>
        ))}
      </select>
    </div>
  );
}
