import { OrgRepository } from "@/server/core/repository";

export class RosterRepository extends OrgRepository {
  // `teacherId` null = no manager restriction (owner/admin see all).
  async listClasses(teacherId: string | null) {
    let q = this.table("classes")
      .select("id, name, grade, teacher_id, created_at")
      .eq("org_id", this.orgId)
      .order("created_at", { ascending: false });
    if (teacherId) q = q.eq("teacher_id", teacherId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  }

  async listClassesRaw(teacherId: string | null) {
    let q = this.table("classes")
      .select("id, name, grade, teacher_id, created_at")
      .eq("org_id", this.orgId)
      .order("name");
    if (teacherId) q = q.eq("teacher_id", teacherId);
    const { data } = await q;
    return data ?? [];
  }

  async teacherNames(ids: string[]) {
    const { data } = await this.table("profiles")
      .select("id, full_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    return new Map((data ?? []).map((p) => [p.id, p.full_name]));
  }

  async studentClassIds() {
    const { data } = await this.table("students").select("class_id").eq("org_id", this.orgId);
    return (data ?? []).map((s) => s.class_id);
  }

  async classCount() {
    const { count } = await this.table("classes")
      .select("id", { count: "exact", head: true })
      .eq("org_id", this.orgId);
    return count ?? 0;
  }

  async insertClass(input: { name: string; grade: string | null; teacherId: string }) {
    const { data, error } = await this.table("classes")
      .insert({ org_id: this.orgId, name: input.name, grade: input.grade, teacher_id: input.teacherId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
}
