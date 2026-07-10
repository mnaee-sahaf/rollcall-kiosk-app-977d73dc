import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Admin = SupabaseClient<Database>;
type TableName = keyof Database["public"]["Tables"];

// Tables that carry an org_id column — the only tables scoped() accepts.
export type OrgScopedTable = {
  [K in TableName]: Database["public"]["Tables"][K]["Row"] extends { org_id: string }
    ? K
    : never;
}[TableName];

// Base for all domain repositories. `scoped(table)` returns a read builder with
// the org_id filter already applied — the ONLY place org scoping lives. The
// OrgScopedTable bound guarantees the table has org_id; supabase-js cannot
// narrow a column name for a generic table parameter, so the eq args are
// asserted (sound given the bound). Writes use `table(name)` with concrete
// literals and stamp/filter org_id explicitly.
export class OrgRepository {
  constructor(
    protected readonly admin: Admin,
    public readonly orgId: string,
  ) {}

  protected scoped<T extends OrgScopedTable>(table: T) {
    return this.admin
      .from(table)
      .select("*")
      .eq("org_id" as never, this.orgId as never);
  }

  protected table<T extends TableName>(table: T) {
    return this.admin.from(table);
  }
}
