import { describe, expect, it } from "vitest";
import {
  EMPTY_DOC,
  isEmptyRichText,
  mentionedUserIds,
  plainToRichText,
  richTextSchema,
  richTextToPlain,
  type RichTextDoc,
} from "@/lib/rich-text";
import { excerptOf } from "@/server/services/mention";

const doc = (...content: unknown[]): unknown => ({ type: "doc", content });
const para = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (value: string) => ({ type: "text", text: value });
const mention = (id: string, label: string) => ({
  type: "mention",
  attrs: { id, label },
});

describe("richTextSchema", () => {
  it("accepts the node and mark types the editor can produce", () => {
    const value = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("หัวข้อ")] },
      para(
        { type: "text", text: "หนา", marks: [{ type: "bold" }] },
        { type: "hardBreak" },
        mention("u1", "ปอ"),
      ),
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [para(text("ข้อหนึ่ง"))] }],
      },
      { type: "blockquote", content: [para(text("อ้างอิง"))] },
      { type: "codeBlock", content: [text("const a = 1;")] },
    );

    expect(richTextSchema.safeParse(value).success).toBe(true);
  });

  it("rejects a node type that is not on the allowlist", () => {
    // An <img>-style node would be a way to smuggle a remote URL into the page.
    expect(
      richTextSchema.safeParse(doc({ type: "image", attrs: { src: "x" } }))
        .success,
    ).toBe(false);
    // Nested out of sight, it must still be rejected.
    expect(
      richTextSchema.safeParse(
        doc(para({ type: "iframe", attrs: { src: "javascript:1" } })),
      ).success,
    ).toBe(false);
  });

  it("rejects a mark type that is not on the allowlist", () => {
    expect(
      richTextSchema.safeParse(
        doc(para({ type: "text", text: "x", marks: [{ type: "link" }] })),
      ).success,
    ).toBe(false);
  });

  it("rejects a mention without a usable id", () => {
    expect(richTextSchema.safeParse(doc(para(mention("", "ปอ")))).success).toBe(
      false,
    );
  });

  it("rejects anything that is not a document", () => {
    expect(richTextSchema.safeParse({ type: "paragraph" }).success).toBe(false);
    expect(richTextSchema.safeParse("<b>hi</b>").success).toBe(false);
    expect(richTextSchema.safeParse(null).success).toBe(false);
  });
});

describe("plainToRichText", () => {
  it("splits blank lines into paragraphs", () => {
    expect(plainToRichText("บรรทัดหนึ่ง\n\nบรรทัดสอง")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "บรรทัดหนึ่ง" }] },
        { type: "paragraph", content: [{ type: "text", text: "บรรทัดสอง" }] },
      ],
    });
  });

  it("never emits an empty text node, which ProseMirror rejects", () => {
    expect(plainToRichText("")).toEqual(EMPTY_DOC);
    expect(plainToRichText("   \n\n  ")).toEqual(EMPTY_DOC);
  });

  it("keeps every paragraph when read back as plain text", () => {
    // Blocks are joined with a single newline: plain text is for excerpts and
    // notifications, so it carries the words, not the original spacing.
    expect(
      richTextToPlain(plainToRichText("งานเสร็จแล้ว\n\nพรุ่งนี้ทำต่อ")),
    ).toBe("งานเสร็จแล้ว\nพรุ่งนี้ทำต่อ");
  });
});

describe("richTextToPlain", () => {
  it("reads a mention back as @label", () => {
    const value = doc(
      para(text("ฝาก "), mention("u1", "ปอ"), text(" ดูให้หน่อย")),
    ) as RichTextDoc;
    expect(richTextToPlain(value)).toBe("ฝาก @ปอ ดูให้หน่อย");
  });

  it("puts each block on its own line", () => {
    const value = doc(
      { type: "heading", attrs: { level: 3 }, content: [text("สรุป")] },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [para(text("ข้อหนึ่ง"))] },
          { type: "listItem", content: [para(text("ข้อสอง"))] },
        ],
      },
    ) as RichTextDoc;
    expect(richTextToPlain(value)).toBe("สรุป\nข้อหนึ่งข้อสอง");
  });

  it("returns an empty string for nothing", () => {
    expect(richTextToPlain(null)).toBe("");
    expect(richTextToPlain(undefined)).toBe("");
    expect(richTextToPlain(EMPTY_DOC)).toBe("");
  });
});

describe("isEmptyRichText", () => {
  it("treats a document with no readable text as empty", () => {
    expect(isEmptyRichText(EMPTY_DOC)).toBe(true);
    expect(isEmptyRichText(null)).toBe(true);
    // TipTap leaves an empty paragraph behind when the user clears the field.
    expect(isEmptyRichText(doc(para()) as RichTextDoc)).toBe(true);
    expect(isEmptyRichText(doc(para(text("   "))) as RichTextDoc)).toBe(true);
  });

  it("counts a lone mention as content", () => {
    expect(isEmptyRichText(doc(para(mention("u1", "ปอ"))) as RichTextDoc)).toBe(
      false,
    );
  });
});

describe("mentionedUserIds", () => {
  it("collects ids in document order without duplicates", () => {
    const value = doc(
      para(mention("u2", "เอ"), text(" กับ "), mention("u1", "บี")),
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [para(mention("u2", "เอ"))] },
          { type: "listItem", content: [para(mention("u3", "ซี"))] },
        ],
      },
    ) as RichTextDoc;
    expect(mentionedUserIds(value)).toEqual(["u2", "u1", "u3"]);
  });

  it("returns nothing when there are no mentions", () => {
    expect(mentionedUserIds(plainToRichText("ไม่มีใครถูกแท็ก"))).toEqual([]);
    expect(mentionedUserIds(null)).toEqual([]);
  });
});

describe("excerptOf", () => {
  it("collapses whitespace and keeps short text whole", () => {
    expect(excerptOf(plainToRichText("สั้น"))).toBe("สั้น");
    expect(
      excerptOf(doc(para(text("a")), para(text("b"))) as RichTextDoc),
    ).toBe("a b");
  });

  it("truncates long text to the limit", () => {
    const result = excerptOf(plainToRichText("ก".repeat(500)));
    expect(result).toHaveLength(120);
    expect(result.endsWith("…")).toBe(true);
  });
});
