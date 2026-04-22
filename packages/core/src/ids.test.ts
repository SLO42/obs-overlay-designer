import { describe, expect, it } from "vitest";
import { id } from "./ids";

const URL_SAFE = /^[A-Za-z0-9_-]+$/;

describe("id", () => {
  it("returns 21-char url-safe strings", () => {
    for (let i = 0; i < 100; i++) {
      const value = id();
      expect(value).toHaveLength(21);
      expect(URL_SAFE.test(value)).toBe(true);
    }
  });

  it("produces no duplicates over 10k calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      set.add(id());
    }
    expect(set.size).toBe(10_000);
  });

  it("is time-sortable: newer ids sort lexically >= older ids", async () => {
    const older = id();
    // A tiny wait ensures Date.now() advances at least 1ms, giving a
    // strictly greater timestamp prefix.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = id();
    expect(newer >= older).toBe(true);
    // And the timestamp prefix (first 9 chars) is base-36-valid.
    const prefix = newer.slice(0, 9);
    expect(/^[0-9a-z]+$/.test(prefix)).toBe(true);
  });

  it("bulk ids produced in sequence are sorted non-decreasingly by prefix", () => {
    const ids = Array.from({ length: 200 }, () => id());
    const prefixes = ids.map((value) => value.slice(0, 9));
    const sorted = [...prefixes].sort();
    expect(prefixes).toEqual(sorted);
  });
});
