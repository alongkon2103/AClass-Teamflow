"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

const SEARCH_DEBOUNCE_MS = 300;

type Option = { id: string; name: string };

/**
 * Search and filters for the archive, mirrored into the URL so a narrowed view
 * can be shared and survives a refresh — the same contract as the dashboard.
 */
export function ArchiveFilters({
  members,
  games,
  canFilterMembers,
}: {
  members: Option[];
  games: Option[];
  /** Members only ever see their own tasks, so the picker would do nothing. */
  canFilterMembers: boolean;
}) {
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
          aria-label="ค้นหางานในคลัง"
          className="text-ink h-10 w-48 border-none bg-transparent text-[13px] outline-none"
        />
      </div>

      {canFilterMembers ? (
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
      ) : null}

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
