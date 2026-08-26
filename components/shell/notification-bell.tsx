"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { relativeThaiTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import {
  fetchNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/notification";

type Item = {
  id: string;
  message: string;
  href: string;
  createdAt: string;
  read: boolean;
  payload: { excerpt?: string };
  actor: { name: string; avatarColor: string } | null;
};

const POLL_INTERVAL_MS = 60_000;

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const result = await fetchNotificationsAction();
    setItems(result.items as unknown as Item[]);
    setUnread(result.unreadCount);
  }, []);

  // Poll rather than hold a socket open (SPEC 5.9).
  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const openItem = (item: Item) => {
    setOpen(false);
    // Optimistic: clear the dot immediately, then persist.
    if (!item.read) {
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, read: true } : row,
        ),
      );
      setUnread((count) => Math.max(0, count - 1));
    }
    startTransition(async () => {
      await markNotificationReadAction(item.id);
      router.push(item.href);
    });
  };

  const readAll = () => {
    setItems((current) => current.map((row) => ({ ...row, read: true })));
    setUnread(0);
    startTransition(async () => {
      await markAllNotificationsReadAction();
      await load();
    });
  };

  return (
    <div className="relative" ref={panel}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={
          unread > 0
            ? `การแจ้งเตือน ${unread} รายการที่ยังไม่อ่าน`
            : "การแจ้งเตือน"
        }
        aria-expanded={open}
        className="border-line bg-hover text-ink hover:bg-primary-soft relative inline-flex size-10 items-center justify-center rounded-xl border transition-colors duration-150"
      >
        <Bell size={16} strokeWidth={2} />
        {unread > 0 ? (
          <span className="bg-danger absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="border-line bg-surface shadow-lift absolute top-12 right-0 z-50 w-[340px] overflow-hidden rounded-2xl border">
          <div className="border-line flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-bold">การแจ้งเตือน</span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={readAll}
                className="text-primary-ink text-xs font-semibold"
              >
                อ่านทั้งหมด
              </button>
            ) : null}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <EmptyState icon={Bell} message="ยังไม่มีการแจ้งเตือน" />
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={cn(
                    "border-line hover:bg-hover flex w-full gap-3 border-b px-4 py-3 text-left transition-colors duration-150",
                    !item.read && "bg-primary-soft",
                  )}
                >
                  {item.actor ? (
                    <Avatar user={item.actor} size={32} />
                  ) : (
                    <span className="bg-track size-8 shrink-0 rounded-full" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-snug">
                      {item.message}
                    </span>
                    {item.payload?.excerpt ? (
                      <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                        {item.payload.excerpt}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground mt-1 block text-[11px]">
                      {relativeThaiTime(item.createdAt)}
                    </span>
                  </span>
                  {!item.read ? (
                    <span
                      aria-hidden="true"
                      className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
                    />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
