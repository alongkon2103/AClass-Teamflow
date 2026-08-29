import type { Prisma } from "@prisma/client";
import { NotificationType } from "@prisma/client";
import type { Actor } from "@/lib/permissions";
import {
  mentionedUserIds,
  richTextToPlain,
  type RichTextDoc,
} from "@/lib/rich-text";

/** Short preview of a document, for notification payloads. */
export function excerptOf(doc: RichTextDoc | null | undefined, limit = 120) {
  const text = richTextToPlain(doc).replace(/\s+/g, " ").trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

/**
 * Notifies everyone newly @-mentioned in a document.
 *
 * `alreadyNotified` covers people who are getting a notification about the same
 * action anyway (the progress author, say), so a single write never lands twice
 * in one inbox. Mentioning yourself is ignored.
 */
export async function notifyMentions(
  tx: Prisma.TransactionClient,
  actor: Actor,
  doc: RichTextDoc | null | undefined,
  context: {
    taskId?: string;
    taskTitle?: string;
    meetingId?: string;
    meetingTitle?: string;
  },
  alreadyNotified: string[] = [],
) {
  const mentioned = mentionedUserIds(doc).filter(
    (id) => id !== actor.id && !alreadyNotified.includes(id),
  );
  if (mentioned.length === 0) return [];

  // Only real, active accounts: a stale id in the document must not create rows.
  const recipients = await tx.user.findMany({
    where: { id: { in: mentioned }, isActive: true },
    select: { id: true },
  });
  if (recipients.length === 0) return [];

  await tx.notification.createMany({
    data: recipients.map((recipient) => ({
      recipientId: recipient.id,
      actorId: actor.id,
      type: NotificationType.MENTIONED,
      payload: { ...context, excerpt: excerptOf(doc) },
    })),
  });

  return recipients.map((recipient) => recipient.id);
}
