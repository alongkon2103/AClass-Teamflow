import { EMPTY_DOC, type RichNode, type RichTextDoc } from "@/lib/rich-text";

export type MentionTarget = { id: string; name: string };

/**
 * `@Name` in a line typed at the shell becomes a real mention node, so a CLI
 * update notifies people exactly like one written in the browser.
 *
 * A name with spaces goes in square brackets: `@[ชื่อ นามสกุล]`. A token that
 * matches nobody is left alone as plain text rather than guessed at.
 */
const MENTION = /@\[([^\]]+)\]|@([^\s@[\]]+)/g;

export function textToRichText(
  text: string,
  members: MentionTarget[],
): RichTextDoc {
  const paragraphs = text.split(/\n{2,}/).filter((part) => part.trim() !== "");
  if (paragraphs.length === 0) return EMPTY_DOC;

  return {
    type: "doc",
    content: paragraphs.map((paragraph) => ({
      type: "paragraph",
      content: inlineNodes(paragraph, members),
    })),
  };
}

function inlineNodes(text: string, members: MentionTarget[]): RichNode[] {
  const nodes: RichNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(MENTION)) {
    const name = match[1] ?? match[2];
    const member = findMember(name, members);
    if (!member) continue;

    const start = match.index ?? 0;
    if (start > cursor) {
      nodes.push({ type: "text", text: text.slice(cursor, start) });
    }
    nodes.push({
      type: "mention",
      attrs: { id: member.id, label: member.name },
    });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push({ type: "text", text: text.slice(cursor) });
  }
  return nodes;
}

function findMember(
  name: string,
  members: MentionTarget[],
): MentionTarget | null {
  const needle = name.trim().toLowerCase();
  const exact = members.find((member) => member.name.toLowerCase() === needle);
  if (exact) return exact;

  // A single partial match is unambiguous enough to use; several are not.
  const partial = members.filter((member) =>
    member.name.toLowerCase().startsWith(needle),
  );
  return partial.length === 1 ? partial[0] : null;
}
