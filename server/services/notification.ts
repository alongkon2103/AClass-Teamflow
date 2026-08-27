import type { PrismaClient, NotificationType } from "@prisma/client";
import type { Actor } from "@/lib/permissions";

/** Payload shapes written by the other services. All fields are optional. */
export type NotificationPayload = {
  taskId?: string;
  taskTitle?: string;
  excerpt?: string;
  leaveId?: string;
  feedbackId?: string;
  ticketNumber?: string;
  userName?: string;
  status?: string;
};

export type NotificationView = {
  id: string;
  type: NotificationType;
  payload: NotificationPayload;
  createdAt: string;
  read: boolean;
  actor: { name: string; avatarColor: string } | null;
  href: string;
};

/** Where clicking a notification should take the recipient. */
export function notificationHref(
  type: NotificationType,
  payload: NotificationPayload,
): string {
  switch (type) {
    case "PROGRESS_SUBMITTED":
    case "TASK_ASSIGNED":
      return payload.taskId ? `/board?task=${payload.taskId}` : "/board";
    case "LEAVE_REQUESTED":
    case "LEAVE_DECIDED":
      return "/calendar";
    case "PROGRESS_REPLIED":
    case "FEEDBACK_REPLIED":
      if (type === "PROGRESS_REPLIED") {
        return payload.taskId ? `/board?task=${payload.taskId}` : "/board";
      }
      return payload.feedbackId
        ? `/feedback?ticket=${payload.feedbackId}`
        : "/feedback";
    default:
      return "/board";
  }
}

/** Human-readable Thai sentence for a notification. */
export function notificationMessage(
  type: NotificationType,
  payload: NotificationPayload,
  actorName: string | null,
): string {
  const who = actorName ?? "มีผู้ใช้";
  switch (type) {
    case "PROGRESS_SUBMITTED":
      return `${who} ส่งความคืบหน้าใน "${payload.taskTitle ?? "งาน"}"`;
    case "TASK_ASSIGNED":
      return `${who} มอบหมายงาน "${payload.taskTitle ?? "งาน"}" ให้คุณ`;
    case "LEAVE_REQUESTED":
      return `${payload.userName ?? who} ขอลางาน`;
    case "LEAVE_DECIDED":
      return payload.status === "APPROVED"
        ? "คำขอลาของคุณได้รับการอนุมัติแล้ว"
        : "คำขอลาของคุณไม่ได้รับการอนุมัติ";
    case "PROGRESS_REPLIED":
      return `${who} ตอบกลับความคืบหน้าใน "${payload.taskTitle ?? "งาน"}"`;
    case "FEEDBACK_REPLIED":
      return `${who} ตอบกลับฟีดแบค ${payload.ticketNumber ?? ""}`.trim();
    default:
      return "มีการแจ้งเตือนใหม่";
  }
}

export const NOTIFICATION_PAGE_SIZE = 20;

export async function listNotifications(db: PrismaClient, actor: Actor) {
  const [rows, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { recipientId: actor.id },
      select: {
        id: true,
        type: true,
        payload: true,
        readAt: true,
        createdAt: true,
        actor: { select: { name: true, avatarColor: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: NOTIFICATION_PAGE_SIZE,
    }),
    db.notification.count({
      where: { recipientId: actor.id, readAt: null },
    }),
  ]);

  return { rows, unreadCount };
}

export async function markRead(db: PrismaClient, actor: Actor, id: string) {
  // Scoped by recipientId so one user can never mark another's notification.
  await db.notification.updateMany({
    where: { id, recipientId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(db: PrismaClient, actor: Actor) {
  await db.notification.updateMany({
    where: { recipientId: actor.id, readAt: null },
    data: { readAt: new Date() },
  });
}
