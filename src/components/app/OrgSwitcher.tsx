import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { getMyContext } from "@/lib/auth.functions";
import { setActiveOrg } from "@/lib/organization.functions";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type Org = { id: string; name: string; role: string };

export function OrgSwitcher() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fCtx = useServerFn(getMyContext);
  const fSet = useServerFn(setActiveOrg);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fCtx({})
      .then((c) => {
        setOrgs(c.orgs);
        setActiveId(c.activeOrgId);
      })
      .catch(() => {});
  }, [fCtx]);

  const active = orgs.find((o) => o.id === activeId);

  async function switchTo(id: string) {
    if (id === activeId || busy) return;
    setBusy(true);
    try {
      await fSet({ data: { orgId: id } });
      await qc.cancelQueries();
      qc.clear();
      // Full reload so every org-scoped query refetches for the new org.
      window.location.assign("/app");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not switch organization");
      setBusy(false);
    }
  }

  if (orgs.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm hover:bg-muted">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-left font-medium">
            {active?.name ?? "Select organization"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        {orgs.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => switchTo(o.id)}>
            <Check className={`h-4 w-4 mr-2 ${o.id === activeId ? "opacity-100" : "opacity-0"}`} />
            <span className="flex-1 truncate">{o.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/signup" })}>
          <Plus className="h-4 w-4 mr-2" /> Create organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
