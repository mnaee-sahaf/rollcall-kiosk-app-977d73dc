import { describe, it, expect } from "vitest";
import { OrgRepository } from "@/server/core/repository";

// Minimal fake that records the org_id filter applied.
function fakeAdmin() {
  const calls: Array<{ table: string; col: string; val: string }> = [];
  const admin = {
    from(table: string) {
      return {
        select() { return this; },
        eq(col: string, val: string) { calls.push({ table, col, val }); return this; },
      };
    },
  };
  return { admin: admin as any, calls };
}

class ThingRepo extends OrgRepository {
  list() { return (this as any).scoped("students").select("id"); }
}

describe("OrgRepository", () => {
  it("applies the org_id filter on scoped()", () => {
    const { admin, calls } = fakeAdmin();
    new ThingRepo(admin, "org-42").list();
    expect(calls).toContainEqual({ table: "students", col: "org_id", val: "org-42" });
  });
  it("exposes orgId", () => {
    const { admin } = fakeAdmin();
    expect(new ThingRepo(admin, "org-7").orgId).toBe("org-7");
  });
});
