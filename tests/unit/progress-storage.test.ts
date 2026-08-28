import { describe, expect, it } from "vitest";
import { excerpt } from "@/server/services/progress";
import {
  createProgressSchema,
  MAX_PROGRESS_IMAGES,
} from "@/lib/validators/progress";
import { isAllowedImageType, MAX_IMAGE_BYTES } from "@/lib/storage/limits";
import { buildObjectKey } from "@/lib/storage";
import { resolveUploadPath, UPLOAD_ROOT } from "@/lib/storage/local";
import {
  notificationHref,
  notificationMessage,
} from "@/server/services/notification";
import { relativeThaiTime } from "@/lib/relative-time";

describe("excerpt", () => {
  it("leaves short text untouched", () => {
    expect(excerpt("สั้น")).toBe("สั้น");
  });

  it("collapses whitespace", () => {
    expect(excerpt("a\n\n  b")).toBe("a b");
  });

  it("truncates with an ellipsis at the limit", () => {
    const result = excerpt("ก".repeat(500));
    expect(result).toHaveLength(120);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("createProgressSchema", () => {
  const base = { taskId: "t1", entryDate: "2026-08-26", body: "ทำงานเสร็จ" };

  it("accepts an entry with no images at all", () => {
    expect(createProgressSchema.parse(base).imageUrls).toEqual([]);
  });

  it("keeps several images in the order they were attached", () => {
    const urls = ["/a.jpg", "/b.jpg", "/c.jpg"];
    expect(
      createProgressSchema.parse({ ...base, imageUrls: urls }).imageUrls,
    ).toEqual(urls);
  });

  it("drops blank entries that would render as broken images", () => {
    expect(
      createProgressSchema.parse({
        ...base,
        imageUrls: ["/a.jpg", "", "/b.jpg"],
      }).imageUrls,
    ).toEqual(["/a.jpg", "/b.jpg"]);
  });

  it("refuses more images than one update may carry", () => {
    const tooMany = Array.from(
      { length: MAX_PROGRESS_IMAGES + 1 },
      (_, i) => `/img-${i}.jpg`,
    );
    expect(
      createProgressSchema.safeParse({ ...base, imageUrls: tooMany }).success,
    ).toBe(false);
    expect(
      createProgressSchema.safeParse({
        ...base,
        imageUrls: tooMany.slice(0, MAX_PROGRESS_IMAGES),
      }).success,
    ).toBe(true);
  });

  it("rejects an empty body", () => {
    expect(
      createProgressSchema.safeParse({ ...base, body: "   " }).success,
    ).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(
      createProgressSchema.safeParse({ ...base, entryDate: "26-08-2026" })
        .success,
    ).toBe(false);
  });
});

describe("upload guards", () => {
  it("allows only the three declared image types", () => {
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(isAllowedImageType("image/jpeg")).toBe(true);
    expect(isAllowedImageType("image/webp")).toBe(true);
    expect(isAllowedImageType("image/gif")).toBe(false);
    expect(isAllowedImageType("application/pdf")).toBe(false);
  });

  it("caps uploads at 5MB", () => {
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024);
  });

  it("never trusts the client filename for the stored key", () => {
    const key = buildObjectKey("../../etc/passwd", "image/png");
    expect(key.startsWith("progress/")).toBe(true);
    expect(key).not.toContain("..");
    expect(key.endsWith(".png")).toBe(true);
  });

  it("normalises the extension to the real content type", () => {
    expect(buildObjectKey("shot.PNG", "image/jpeg").endsWith(".jpg")).toBe(
      true,
    );
  });

  it("refuses paths that escape the upload root", () => {
    expect(resolveUploadPath("../secret.png")).toBeNull();
    expect(resolveUploadPath("progress/../../etc/passwd")).toBeNull();
    expect(resolveUploadPath("progress/a.png")?.startsWith(UPLOAD_ROOT)).toBe(
      true,
    );
  });
});

describe("notification presentation", () => {
  it("links each type at the right place", () => {
    expect(notificationHref("PROGRESS_SUBMITTED", { taskId: "t1" })).toBe(
      "/board?task=t1",
    );
    expect(notificationHref("LEAVE_DECIDED", {})).toBe("/calendar");
    expect(notificationHref("FEEDBACK_REPLIED", { feedbackId: "f1" })).toBe(
      "/feedback?ticket=f1",
    );
  });

  it("falls back when the payload has no id", () => {
    expect(notificationHref("TASK_ASSIGNED", {})).toBe("/board");
  });

  it("writes Thai sentences naming the actor", () => {
    expect(
      notificationMessage("PROGRESS_SUBMITTED", { taskTitle: "งาน A" }, "นภา"),
    ).toContain("นภา");
    expect(
      notificationMessage("LEAVE_DECIDED", { status: "APPROVED" }, null),
    ).toContain("อนุมัติ");
    expect(
      notificationMessage("LEAVE_DECIDED", { status: "REJECTED" }, null),
    ).toContain("ไม่ได้รับ");
  });
});

describe("relativeThaiTime", () => {
  const now = new Date("2026-08-26T10:00:00+07:00");

  it("labels today and yesterday", () => {
    expect(relativeThaiTime("2026-08-26T02:00:00+07:00", now)).toBe("วันนี้");
    expect(relativeThaiTime("2026-08-25T22:00:00+07:00", now)).toBe("เมื่อวาน");
  });

  it("counts days within the week", () => {
    expect(relativeThaiTime("2026-08-23T10:00:00+07:00", now)).toBe(
      "3 วันก่อน",
    );
  });

  it("falls back to an absolute date beyond a week", () => {
    expect(relativeThaiTime("2026-08-01T10:00:00+07:00", now)).toContain(
      "2569",
    );
  });
});
