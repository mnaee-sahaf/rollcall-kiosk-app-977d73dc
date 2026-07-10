import { describe, it, expect } from "vitest";
import { pickActiveOrgId } from "@/server/core/org-context";

describe("pickActiveOrgId", () => {
  it("returns the preferred org when the user is still a member", () => {
    expect(pickActiveOrgId("org-a", ["org-a", "org-b"])).toBe("org-a");
  });
  it("ignores a stale preference and falls back to first membership", () => {
    expect(pickActiveOrgId("org-x", ["org-a", "org-b"])).toBe("org-a");
  });
  it("returns null when the user has no memberships", () => {
    expect(pickActiveOrgId("org-a", [])).toBeNull();
  });
  it("returns first membership when there is no preference", () => {
    expect(pickActiveOrgId(null, ["org-b", "org-c"])).toBe("org-b");
  });
});
