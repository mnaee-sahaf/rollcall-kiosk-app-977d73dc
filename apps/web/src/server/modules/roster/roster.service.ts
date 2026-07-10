import type { Admin } from "@/server/core/repository";
import { RosterRepository } from "@/server/modules/roster/roster.repository";
import { assertWithinPlan } from "@/lib/plans";

// Pure: managers are restricted to their own classes; owner/admin are not.
export function managerScope(role: string, userId: string): string | null {
  return role === "manager" ? userId : null;
}

export class RosterService {
  private repo: RosterRepository;
  constructor(
    private admin: Admin,
    orgId: string,
    private role: string,
    private userId: string,
  ) {
    this.repo = new RosterRepository(admin, orgId);
  }

  listClasses() {
    return this.repo.listClasses(managerScope(this.role, this.userId));
  }

  async listClassesWithMeta() {
    const classes = await this.repo.listClassesRaw(managerScope(this.role, this.userId));
    const ids = classes.map((c) => c.teacher_id).filter((x): x is string => !!x);
    const nameMap = await this.repo.teacherNames(ids);
    const classIds = await this.repo.studentClassIds();
    const countMap = new Map<string, number>();
    for (const cid of classIds) countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
    return classes.map((c) => ({
      ...c,
      teacher_name: c.teacher_id ? (nameMap.get(c.teacher_id) ?? null) : null,
      student_count: countMap.get(c.id) ?? 0,
    }));
  }

  async createClass(input: { name: string; grade?: string; teacherId?: string }) {
    // Behavior-preserving: match the original blocklist + message exactly, and
    // stay consistent with the sibling class handlers (updateClass/deleteClass).
    // Hardening to an owner/admin allowlist across ALL class handlers is a
    // deliberate follow-on, not this refactor.
    if (this.role === "manager") throw new Error("Only owners and admins can manage classes");
    await assertWithinPlan(this.admin, this.repo.orgId, "classes");
    return this.repo.insertClass({
      name: input.name,
      grade: input.grade ?? null,
      teacherId: input.teacherId ?? this.userId,
    });
  }
}
