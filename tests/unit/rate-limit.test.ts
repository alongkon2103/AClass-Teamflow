import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("login rate limiting", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows exactly 5 attempts per minute, then blocks", () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(rateLimit("login:1.1.1.1").allowed).toBe(true);
    }
    const blocked = rateLimit("login:1.1.1.1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each key (IP) independently", () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      rateLimit("login:1.1.1.1");
    }
    expect(rateLimit("login:1.1.1.1").allowed).toBe(false);
    // A different IP starts with a fresh budget.
    expect(rateLimit("login:2.2.2.2").allowed).toBe(true);
  });

  it("reports the remaining budget as attempts are used", () => {
    expect(rateLimit("login:3.3.3.3").remaining).toBe(4);
    expect(rateLimit("login:3.3.3.3").remaining).toBe(3);
  });

  it("resets once the window has elapsed", () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      rateLimit("login:4.4.4.4");
    }
    expect(rateLimit("login:4.4.4.4").allowed).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(rateLimit("login:4.4.4.4").allowed).toBe(true);
  });

  it("honours a custom limit and window", () => {
    expect(rateLimit("login:5.5.5.5", 2, 1_000).allowed).toBe(true);
    expect(rateLimit("login:5.5.5.5", 2, 1_000).allowed).toBe(true);
    expect(rateLimit("login:5.5.5.5", 2, 1_000).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect(rateLimit("login:5.5.5.5", 2, 1_000).allowed).toBe(true);
  });
});
