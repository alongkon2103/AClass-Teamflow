import { describe, expect, it } from "vitest";
import { FeedbackStatus } from "@prisma/client";
import {
  formatTicketNumber,
  highestSequence,
  parseFeedbackFilters,
} from "@/server/services/feedback";
import {
  feedbackFormSchema,
  replyFeedbackSchema,
  gameNameSchema,
} from "@/lib/validators/feedback";

describe("ticket numbers", () => {
  it("pads to four digits", () => {
    expect(formatTicketNumber(1)).toBe("TK-0001");
    expect(formatTicketNumber(42)).toBe("TK-0042");
  });

  it("does not truncate once past four digits", () => {
    expect(formatTicketNumber(12345)).toBe("TK-12345");
  });

  it("finds the highest sequence numerically, not alphabetically", () => {
    // "TK-0009" sorts after "TK-0010" as text; the parse must use numbers.
    expect(highestSequence(["TK-0009", "TK-0010"])).toBe(10);
    expect(highestSequence(["TK-0002", "TK-0100", "TK-0007"])).toBe(100);
  });

  it("ignores malformed numbers and empty input", () => {
    expect(highestSequence([])).toBe(0);
    expect(highestSequence(["ABC-1", "TK-", "TK-0003"])).toBe(3);
  });

  it("continues from the highest existing number", () => {
    const next = highestSequence(["TK-0001", "TK-0003"]) + 1;
    expect(formatTicketNumber(next)).toBe("TK-0004");
  });
});

describe("parseFeedbackFilters", () => {
  it("keeps valid status values and drops junk", () => {
    expect(parseFeedbackFilters({ status: FeedbackStatus.FIXING }).status).toBe(
      FeedbackStatus.FIXING,
    );
    expect(parseFeedbackFilters({ status: "NOPE" }).status).toBeNull();
  });

  it("trims search and treats a blank game as absent", () => {
    expect(parseFeedbackFilters({ q: "  เสียง " }).search).toBe("เสียง");
    expect(parseFeedbackFilters({ game: "  " }).gameId).toBeNull();
  });
});

describe("feedbackFormSchema", () => {
  const base = {
    customerName: "ลูกค้า",
    reportedAt: "2026-08-26",
    gameId: "g1",
    body: "เนื้อหา",
  };

  it("accepts a valid submission and nulls a blank ticket", () => {
    expect(
      feedbackFormSchema.parse({ ...base, ticketNumber: "" }).ticketNumber,
    ).toBeNull();
  });

  it("requires a game to be chosen", () => {
    expect(feedbackFormSchema.safeParse({ ...base, gameId: "" }).success).toBe(
      false,
    );
  });

  it("rejects an empty customer or body", () => {
    expect(
      feedbackFormSchema.safeParse({ ...base, customerName: " " }).success,
    ).toBe(false);
    expect(feedbackFormSchema.safeParse({ ...base, body: " " }).success).toBe(
      false,
    );
  });
});

describe("replyFeedbackSchema", () => {
  it("defaults createTask to false", () => {
    const parsed = replyFeedbackSchema.parse({
      id: "f1",
      status: FeedbackStatus.PENDING,
      replyBody: "ok",
    });
    expect(parsed.createTask).toBe(false);
    expect(parsed.assigneeId).toBeNull();
  });

  it("rejects an unknown status", () => {
    expect(
      replyFeedbackSchema.safeParse({ id: "f1", status: "MAYBE" }).success,
    ).toBe(false);
  });
});

describe("gameNameSchema", () => {
  it("trims and requires a name", () => {
    expect(gameNameSchema.parse({ name: "  Pixel  " }).name).toBe("Pixel");
    expect(gameNameSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});
