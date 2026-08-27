import { describe, expect, it } from "vitest";
import { buildObjectKey } from "@/lib/storage";
import { AVATAR_OUTPUT_SIZE } from "@/lib/crop-image";
import { setAvatarSchema } from "@/lib/validators/member";

describe("avatar storage keys", () => {
  it("files avatars separately from progress images", () => {
    expect(buildObjectKey("me.png", "image/png", "avatar")).toMatch(
      /^avatar\/[0-9a-f-]{36}\.png$/,
    );
    expect(buildObjectKey("shot.png", "image/png")).toMatch(/^progress\//);
  });

  it("never trusts the client filename", () => {
    const key = buildObjectKey("../../etc/passwd", "image/jpeg", "avatar");
    expect(key).not.toContain("..");
    expect(key.startsWith("avatar/")).toBe(true);
    expect(key.endsWith(".jpg")).toBe(true);
  });

  it("normalises the extension to the real content type", () => {
    // The cropper always outputs JPEG, whatever was picked.
    expect(buildObjectKey("photo.PNG", "image/jpeg", "avatar")).toMatch(
      /\.jpg$/,
    );
  });
});

describe("setAvatarSchema", () => {
  it("accepts a path served by this app", () => {
    expect(
      setAvatarSchema.parse({ avatarUrl: "/api/uploads/avatar/a.jpg" })
        .avatarUrl,
    ).toBe("/api/uploads/avatar/a.jpg");
  });

  it("accepts an absolute URL from a storage provider", () => {
    expect(
      setAvatarSchema.parse({ avatarUrl: "https://cdn.example.com/a.jpg" })
        .avatarUrl,
    ).toBe("https://cdn.example.com/a.jpg");
  });

  it("treats an empty value as clearing the photo", () => {
    expect(setAvatarSchema.parse({ avatarUrl: "" }).avatarUrl).toBeNull();
    expect(setAvatarSchema.parse({ avatarUrl: null }).avatarUrl).toBeNull();
    expect(setAvatarSchema.parse({}).avatarUrl).toBeNull();
  });

  it("rejects anything that is not a path or http(s) URL", () => {
    // A javascript: or data: URL must never reach an <img src>.
    for (const bad of [
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "ftp://example.com/a.jpg",
      "example.com/a.jpg",
    ]) {
      expect(setAvatarSchema.safeParse({ avatarUrl: bad }).success).toBe(false);
    }
  });
});

describe("crop output", () => {
  it("renders a square at a size that stays sharp on a retina header", () => {
    expect(AVATAR_OUTPUT_SIZE).toBe(512);
  });
});
