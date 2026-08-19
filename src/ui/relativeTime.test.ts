import { describe, expect, it } from "vitest";
import { formatLocalDateTime, formatRelativeTime } from "@/ui/relativeTime";

const NOW = Date.parse("2026-08-16T20:00:00Z");

describe("formatRelativeTime", () => {
  it("uses minutes, hours, days, weeks, months, and years", () => {
    const cases: Array<[string, string]> = [
      ["2026-08-16T20:00:00Z", "just now"],
      ["2026-08-16T19:50:00Z", "10 minutes ago"],
      ["2026-08-16T19:00:00Z", "1 hour ago"],
      ["2026-08-16T10:00:00Z", "10 hours ago"],
      ["2026-08-15T20:00:00Z", "1 day ago"],
      ["2026-08-13T20:00:00Z", "3 days ago"],
      ["2026-08-09T20:00:00Z", "1 week ago"],
      ["2026-08-02T20:00:00Z", "2 weeks ago"],
      ["2026-07-16T20:00:00Z", "1 month ago"],
      ["2026-06-16T20:00:00Z", "2 months ago"],
      ["2025-08-16T20:00:00Z", "1 year ago"],
      ["2024-08-16T20:00:00Z", "2 years ago"],
    ];
    for (const [iso, label] of cases) {
      expect(formatRelativeTime(iso, NOW), iso).toBe(label);
    }
  });

  it("returns empty for an invalid stamp", () => {
    expect(formatRelativeTime("", NOW)).toBe("");
  });
});

describe("formatLocalDateTime", () => {
  it("uses the local timezone", () => {
    const iso = "2026-08-16T16:00:00Z";
    expect(formatLocalDateTime(iso)).toBe(
      new Date(iso).toLocaleString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
  });
});
