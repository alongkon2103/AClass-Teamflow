"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import {
  listNotifications,
  markAllRead,
  markRead,
  notificationHref,
  notificationMessage,
  type NotificationPayload,
  type NotificationView,
} from "@/server/services/notification";

/** Polled by the bell every 60s (SPEC 5.9). */
export async function fetchNotificationsAction(): Promise<{
  items: NotificationView[];
  unreadCount: number;
}> {
  const actor = await requireActor();
  const { rows, unreadCount } = await listNotifications(db, actor);

  return {
    unreadCount,
    items: rows.map((row) => {
      const payload = (row.payload ?? {}) as NotificationPayload;
      return {
        id: row.id,
        type: row.type,
        payload,
        createdAt: row.createdAt.toISOString(),
        read: row.readAt !== null,
        actor: row.actor,
        href: notificationHref(row.type, payload),
        message: notificationMessage(
          row.type,
          payload,
          row.actor?.name ?? null,
        ),
      } as NotificationView & { message: string };
    }),
  };
}

export async function markNotificationReadAction(id: string) {
  const actor = await requireActor();
  await markRead(db, actor, id);
  revalidatePath("/board");
}

export async function markAllNotificationsReadAction() {
  const actor = await requireActor();
  await markAllRead(db, actor);
  revalidatePath("/board");
}
