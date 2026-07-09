import { describe, it, expect } from "vitest";
import { managerScope } from "@/server/modules/roster/roster.service";

describe("managerScope", () => {
  it("returns the user id for managers (own classes only)", () => {
    expect(managerScope("manager", "user-1")).toBe("user-1");
  });
  it("returns null (no restriction) for owner/admin", () => {
    expect(managerScope("owner", "user-1")).toBeNull();
    expect(managerScope("admin", "user-1")).toBeNull();
  });
});
