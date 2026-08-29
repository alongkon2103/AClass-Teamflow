import { z } from "zod";

/**
 * Rich text is stored as a TipTap (ProseMirror) document, never as HTML.
 *
 * The client can send any JSON it likes, so the schema below is an allowlist:
 * only these node and mark types survive validation. Nothing that could carry
 * script or style gets through, which is why the renderer can build React
 * elements directly and the app never needs dangerouslySetInnerHTML
 * (SPEC section 7).
 */

const MARK_TYPES = ["bold", "italic", "strike", "code"] as const;

const markSchema = z.object({
  type: z.enum(MARK_TYPES),
});

export type RichMark = z.infer<typeof markSchema>;

/** A mention carries the user id, so a rename never breaks the link. */
const mentionAttrsSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
});

export type RichNode =
  | { type: "text"; text: string; marks?: RichMark[] }
  | { type: "hardBreak" }
  | { type: "mention"; attrs: { id: string; label: string } }
  | { type: "paragraph"; content?: RichNode[] }
  | { type: "heading"; attrs: { level: 2 | 3 }; content?: RichNode[] }
  | { type: "bulletList"; content?: RichNode[] }
  | { type: "orderedList"; content?: RichNode[] }
  | { type: "listItem"; content?: RichNode[] }
  | { type: "blockquote"; content?: RichNode[] }
  | { type: "codeBlock"; content?: RichNode[] };

const nodeSchema: z.ZodType<RichNode> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("text"),
      text: z.string().max(20000),
      marks: z.array(markSchema).max(4).optional(),
    }),
    z.object({ type: z.literal("hardBreak") }),
    z.object({ type: z.literal("mention"), attrs: mentionAttrsSchema }),
    z.object({
      type: z.literal("paragraph"),
      content: z.array(nodeSchema).max(200).optional(),
    }),
    z.object({
      type: z.literal("heading"),
      attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
      content: z.array(nodeSchema).max(200).optional(),
    }),
    z.object({
      type: z.literal("bulletList"),
      content: z.array(nodeSchema).max(200).optional(),
    }),
    z.object({
      type: z.literal("orderedList"),
      content: z.array(nodeSchema).max(200).optional(),
    }),
    z.object({
      type: z.literal("listItem"),
      content: z.array(nodeSchema).max(200).optional(),
    }),
    z.object({
      type: z.literal("blockquote"),
      content: z.array(nodeSchema).max(200).optional(),
    }),
    z.object({
      type: z.literal("codeBlock"),
      content: z.array(nodeSchema).max(200).optional(),
    }),
  ]),
);

export const richTextSchema = z.object({
  type: z.literal("doc"),
  content: z.array(nodeSchema).max(500).optional(),
});

export type RichTextDoc = z.infer<typeof richTextSchema>;

export const EMPTY_DOC: RichTextDoc = { type: "doc", content: [] };

/** Wraps plain text in a document, splitting blank lines into paragraphs. */
export function plainToRichText(text: string): RichTextDoc {
  const paragraphs = text.split(/\n{2,}/).filter((part) => part.trim() !== "");
  if (paragraphs.length === 0) return EMPTY_DOC;

  return {
    type: "doc",
    content: paragraphs.map((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }],
    })),
  };
}

/** Readable text for notification excerpts and anywhere markup cannot go. */
export function richTextToPlain(doc: RichTextDoc | null | undefined): string {
  if (!doc?.content) return "";

  const walk = (nodes: RichNode[]): string =>
    nodes
      .map((node) => {
        if (node.type === "text") return node.text;
        if (node.type === "mention") return `@${node.attrs.label}`;
        if (node.type === "hardBreak") return "\n";
        return "content" in node && node.content ? walk(node.content) : "";
      })
      .join("");

  return doc.content
    .map((node) =>
      node.type === "text" || node.type === "mention"
        ? walk([node])
        : "content" in node && node.content
          ? walk(node.content)
          : "",
    )
    .filter((line) => line !== "")
    .join("\n")
    .trim();
}

/** True when the document holds nothing a reader would see. */
export function isEmptyRichText(doc: RichTextDoc | null | undefined): boolean {
  return richTextToPlain(doc) === "";
}

/** Every user id mentioned, de-duplicated and in document order. */
export function mentionedUserIds(
  doc: RichTextDoc | null | undefined,
): string[] {
  const found: string[] = [];

  const walk = (nodes: RichNode[]) => {
    for (const node of nodes) {
      if (node.type === "mention") {
        if (!found.includes(node.attrs.id)) found.push(node.attrs.id);
        continue;
      }
      if ("content" in node && node.content) walk(node.content);
    }
  };

  if (doc?.content) walk(doc.content);
  return found;
}
