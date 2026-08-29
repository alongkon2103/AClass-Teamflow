import { afterEach, describe, expect, it, vi } from "vitest";
import { parseArgs, flagValue, hasFlag } from "@/cli/args";
import { textToRichText } from "@/cli/mentions";
import { displayWidth, dueLabel, pad, table, truncate } from "@/cli/ui";
import { isCancel, listWindow, navigate, parseKey } from "@/cli/prompt";
import { browseAction } from "@/cli/browse";
import { mentionedUserIds, richTextToPlain } from "@/lib/rich-text";

describe("parseArgs", () => {
  it("separates positionals from flags", () => {
    const args = parseArgs(["payment", "แก้บั๊กแล้ว", "--date", "2026-08-29"]);
    expect(args.positional).toEqual(["payment", "แก้บั๊กแล้ว"]);
    expect(flagValue(args, "date")).toBe("2026-08-29");
  });

  it("accepts --flag=value", () => {
    expect(flagValue(parseArgs(["--status=doing"]), "status")).toBe("doing");
  });

  it("treats a flag with no value as a switch", () => {
    const args = parseArgs(["--all", "--status", "done"]);
    expect(hasFlag(args, "all")).toBe(true);
    expect(flagValue(args, "all")).toBeNull();
    expect(flagValue(args, "status")).toBe("done");
  });

  it("does not swallow the next flag as a value", () => {
    const args = parseArgs(["--read", "--all"]);
    expect(hasFlag(args, "read")).toBe(true);
    expect(hasFlag(args, "all")).toBe(true);
  });
});

describe("textToRichText", () => {
  const members = [
    { id: "u1", name: "Mashe" },
    { id: "u2", name: "Poon" },
    { id: "u3", name: "สมชาย ใจดี" },
  ];

  it("turns @Name into a real mention", () => {
    const doc = textToRichText("ฝาก @Mashe ตรวจต่อ", members);
    expect(mentionedUserIds(doc)).toEqual(["u1"]);
    expect(richTextToPlain(doc)).toBe("ฝาก @Mashe ตรวจต่อ");
  });

  it("takes a name with spaces in brackets", () => {
    const doc = textToRichText("แจ้ง @[สมชาย ใจดี] ด้วย", members);
    expect(mentionedUserIds(doc)).toEqual(["u3"]);
  });

  it("matches a unique prefix but never guesses between two", () => {
    expect(mentionedUserIds(textToRichText("@Mas", members))).toEqual(["u1"]);
    // Both names start with the same letter, so neither is chosen.
    const ambiguous = [
      { id: "a", name: "Ploy" },
      { id: "b", name: "Poon" },
    ];
    expect(mentionedUserIds(textToRichText("@P", ambiguous))).toEqual([]);
  });

  it("leaves an unknown handle as plain text", () => {
    const doc = textToRichText("ส่งเมลไป @nobody@example.com แล้ว", members);
    expect(mentionedUserIds(doc)).toEqual([]);
    expect(richTextToPlain(doc)).toBe("ส่งเมลไป @nobody@example.com แล้ว");
  });

  it("splits blank lines into paragraphs", () => {
    const doc = textToRichText("บรรทัดหนึ่ง\n\nบรรทัดสอง", members);
    expect(doc.content).toHaveLength(2);
  });

  it("returns an empty document for nothing typed", () => {
    expect(textToRichText("   ", members).content).toEqual([]);
  });
});

describe("terminal width", () => {
  it("ignores Thai marks that stack on the previous letter", () => {
    // "ที" is two code points but occupies one cell.
    expect(displayWidth("ที")).toBe(1);
    // เ ส ร จ ส น take a cell each; the three marks above them do not.
    expect(displayWidth("เสร็จสิ้น")).toBe(6);
  });

  it("ignores colour codes", () => {
    expect(displayWidth("\u001b[31mred\u001b[39m")).toBe(3);
  });

  it("pads to the display width, not the code-point count", () => {
    expect(pad("ที", 4)).toBe("ที   ");
    expect(displayWidth(pad("ที", 4))).toBe(4);
  });

  it("truncates with an ellipsis inside the budget", () => {
    expect(truncate("abcdefgh", 5)).toBe("abcd…");
    expect(displayWidth(truncate("abcdefgh", 5))).toBe(5);
    expect(truncate("abc", 5)).toBe("abc");
  });
});

/** Runs `body` and returns every line it printed. */
function capture(body: () => void): string[] {
  const lines: string[] = [];
  const spy = vi
    .spyOn(console, "log")
    .mockImplementation((line: unknown) => void lines.push(String(line)));
  try {
    body();
  } finally {
    spy.mockRestore();
  }
  return lines;
}

describe("table", () => {
  afterEach(() => {
    delete process.env.COLUMNS;
  });

  it("draws every line at the same width, Thai content included", () => {
    const lines = capture(() =>
      table(
        [
          { header: "ชื่อ" },
          { header: "สถานะ" },
          { header: "งาน", align: "right" },
        ],
        [
          ["ผู้รับผิดชอบ", "● กำลังทำ", "12"],
          ["A", "เสร็จสิ้น", "3"],
        ],
      ),
    );

    // Top border, header, separator, two rows, bottom border.
    expect(lines).toHaveLength(6);
    expect(new Set(lines.map(displayWidth)).size).toBe(1);
  });

  it("stays inside a narrow terminal by shrinking the flexible column", () => {
    process.env.COLUMNS = "40";
    const lines = capture(() =>
      table(
        [{ header: "ID" }, { header: "ชื่องาน", flex: true }],
        [["cmtayjxf", "Competitor Research – TikTok Interactive Game Shops"]],
      ),
    );

    expect(new Set(lines.map(displayWidth)).size).toBe(1);
    expect(displayWidth(lines[0])).toBeLessThanOrEqual(40);
    // The title is cut, not wrapped, so the grid survives.
    expect(lines.some((line) => line.includes("…"))).toBe(true);
  });

  it("prints nothing when there are no rows", () => {
    expect(capture(() => table([{ header: "ID" }], []))).toEqual([]);
  });
});

describe("dueLabel", () => {
  const today = "2026-08-29";

  it("says how far off the date is", () => {
    expect(dueLabel("2026-08-29", today)).toContain("วันนี้");
    expect(dueLabel("2026-08-27", today)).toContain("เลย 2 วัน");
    expect(dueLabel("2026-09-05", today)).toContain("อีก 7 วัน");
  });

  it("uses the Thai Buddhist-era date", () => {
    expect(dueLabel("2026-09-05", today)).toContain("5 ก.ย. 2569");
  });

  it("shows a dash when nothing is set", () => {
    expect(dueLabel(null, today)).toBe("—");
  });
});

describe("parseKey", () => {
  it("recognises the arrow keys", () => {
    expect(parseKey("\u001b[A").name).toBe("up");
    expect(parseKey("\u001b[B").name).toBe("down");
    expect(parseKey("\u001b[C").name).toBe("right");
    expect(parseKey("\u001b[D").name).toBe("left");
  });

  it("recognises enter, space and escape", () => {
    expect(parseKey("\r").name).toBe("enter");
    expect(parseKey("\n").name).toBe("enter");
    expect(parseKey(" ").name).toBe("space");
    expect(parseKey("\u001b").name).toBe("escape");
    expect(parseKey("\u0003").name).toBe("ctrl-c");
  });

  it("passes anything else through as a character", () => {
    expect(parseKey("q")).toEqual({ name: "char", text: "q" });
  });

  it("tells Escape apart from an escape sequence", () => {
    // Both start with the same byte; only the bare one cancels.
    expect(isCancel(parseKey("\u001b"))).toBe(true);
    expect(isCancel(parseKey("\u001b[A"))).toBe(false);
  });
});

describe("navigate", () => {
  const key = (text: string) => parseKey(text);

  it("moves with the arrows and with j/k", () => {
    expect(navigate(key("\u001b[B"), 0, 5)).toBe(1);
    expect(navigate(key("j"), 0, 5)).toBe(1);
    expect(navigate(key("\u001b[A"), 3, 5)).toBe(2);
    expect(navigate(key("k"), 3, 5)).toBe(2);
  });

  it("wraps around both ends", () => {
    expect(navigate(key("\u001b[A"), 0, 5)).toBe(4);
    expect(navigate(key("\u001b[B"), 4, 5)).toBe(0);
  });

  it("jumps to the ends and by pages, without running off", () => {
    expect(navigate(key("\u001b[H"), 3, 5)).toBe(0);
    expect(navigate(key("\u001b[F"), 0, 5)).toBe(4);
    expect(navigate(key("\u001b[5~"), 2, 40)).toBe(0);
    expect(navigate(key("\u001b[6~"), 38, 40)).toBe(39);
  });

  it("returns null for a key that is not movement", () => {
    expect(navigate(key("\r"), 0, 5)).toBeNull();
    expect(navigate(key(" "), 0, 5)).toBeNull();
    expect(navigate(key("m"), 0, 5)).toBeNull();
  });

  it("does nothing on an empty list", () => {
    expect(navigate(key("\u001b[B"), 0, 0)).toBeNull();
  });
});

describe("listWindow", () => {
  it("shows the whole list when it fits", () => {
    expect(listWindow(0, 4, 10)).toEqual({ start: 0, end: 4 });
  });

  it("keeps the cursor inside the window as it moves", () => {
    for (let index = 0; index < 40; index++) {
      const { start, end } = listWindow(index, 40, 10);
      expect(index).toBeGreaterThanOrEqual(start);
      expect(index).toBeLessThan(end);
      expect(end - start).toBe(10);
    }
  });

  it("stops at the ends instead of scrolling past them", () => {
    expect(listWindow(0, 40, 10).start).toBe(0);
    expect(listWindow(39, 40, 10).end).toBe(40);
  });
});

describe("browseAction", () => {
  it("maps the board shortcuts", () => {
    expect(browseAction(parseKey("\r"))).toBe("open");
    expect(browseAction(parseKey(" "))).toBe("open");
    expect(browseAction(parseKey("m"))).toBe("move");
    expect(browseAction(parseKey("l"))).toBe("log");
    expect(browseAction(parseKey("d"))).toBe("toggle-done");
  });

  it("quits on q, Escape and Ctrl+C", () => {
    expect(browseAction(parseKey("q"))).toBe("quit");
    expect(browseAction(parseKey("\u001b"))).toBe("quit");
    expect(browseAction(parseKey("\u0003"))).toBe("quit");
  });

  it("ignores a key with no meaning here", () => {
    expect(browseAction(parseKey("z"))).toBeNull();
    // Arrows are movement, handled before the action map.
    expect(browseAction(parseKey("\u001b[B"))).toBeNull();
  });
});
