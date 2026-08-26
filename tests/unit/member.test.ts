import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { pickAvatarColour, BCRYPT_COST } from "@/server/services/member";
import { AVATAR_PALETTE } from "@/lib/constants";
import {
  createMemberSchema,
  updateMemberSchema,
  resetPasswordSchema,
} from "@/lib/validators/member";
import { changePasswordSchema } from "@/lib/validators/auth";

describe("pickAvatarColour", () => {
  it("takes the first unused palette colour", () => {
    expect(pickAvatarColour([])).toBe(AVATAR_PALETTE[0]);
    expect(pickAvatarColour([AVATAR_PALETTE[0]])).toBe(AVATAR_PALETTE[1]);
  });

  it("skips over gaps rather than stopping at the first taken colour", () => {
    const taken = [AVATAR_PALETTE[0], AVATAR_PALETTE[1], AVATAR_PALETTE[3]];
    expect(pickAvatarColour(taken)).toBe(AVATAR_PALETTE[2]);
  });

  it("still returns a palette colour once every one is used", () => {
    const result = pickAvatarColour([...AVATAR_PALETTE]);
    expect(AVATAR_PALETTE).toContain(result);
  });

  it("prefers the least-used colour when the palette wraps", () => {
    // Every colour used once, plus extra copies of the first two.
    const taken = [...AVATAR_PALETTE, AVATAR_PALETTE[0], AVATAR_PALETTE[1]];
    expect(pickAvatarColour(taken)).toBe(AVATAR_PALETTE[2]);
  });

  it("ignores colours that are not in the palette", () => {
    expect(pickAvatarColour(["#123456", "#abcdef"])).toBe(AVATAR_PALETTE[0]);
  });
});

describe("createMemberSchema", () => {
  const base = {
    name: "ผู้ทดสอบ",
    email: "Tester@TeamFlow.app",
    role: Role.MEMBER,
    temporaryPassword: "temp12345",
  };

  it("lowercases and trims the email", () => {
    expect(createMemberSchema.parse(base).email).toBe("tester@teamflow.app");
  });

  it("nulls a blank job title", () => {
    expect(
      createMemberSchema.parse({ ...base, jobTitle: "" }).jobTitle,
    ).toBeNull();
  });

  it("requires a temporary password of at least 8 characters", () => {
    expect(
      createMemberSchema.safeParse({ ...base, temporaryPassword: "short" })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(
      createMemberSchema.safeParse({ ...base, email: "nope" }).success,
    ).toBe(false);
  });

  it("rejects a role outside the enum", () => {
    expect(
      createMemberSchema.safeParse({ ...base, role: "ADMIN" }).success,
    ).toBe(false);
  });
});

describe("updateMemberSchema", () => {
  it("keeps a valid update and trims the name", () => {
    const parsed = updateMemberSchema.parse({
      id: "u1",
      name: "  ชื่อ  ",
      jobTitle: null,
      role: Role.LEADER,
    });
    expect(parsed.name).toBe("ชื่อ");
  });
});

describe("resetPasswordSchema", () => {
  it("enforces the same minimum length as creation", () => {
    expect(
      resetPasswordSchema.safeParse({ id: "u1", temporaryPassword: "1234567" })
        .success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ id: "u1", temporaryPassword: "12345678" })
        .success,
    ).toBe(true);
  });
});

describe("changePasswordSchema", () => {
  it("requires the confirmation to match", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old12345",
      newPassword: "new12345",
      confirmPassword: "different",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("refuses reusing the current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "same12345",
      newPassword: "same12345",
      confirmPassword: "same12345",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["newPassword"]);
  });

  it("accepts a well-formed change", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old12345",
        newPassword: "new12345",
        confirmPassword: "new12345",
      }).success,
    ).toBe(true);
  });
});

describe("password hashing cost", () => {
  it("uses the cost the spec requires", () => {
    expect(BCRYPT_COST).toBe(12);
  });
});
