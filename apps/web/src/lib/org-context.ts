// Moved to src/server/core/org-context.ts. Kept as a stable re-export so the
// existing *.functions.ts call sites need no change.
export {
  pickActiveOrgId,
  resolveActiveOrgId,
  resolveActiveMembership,
  requireOrgRole,
} from "@/server/core/org-context";
