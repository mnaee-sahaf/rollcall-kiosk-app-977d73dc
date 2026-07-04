import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // A signed-in user with no org yet (mid-signup, or removed from their only
    // org) goes to /signup to create one.
    const { data: mems } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", data.user.id)
      .limit(1);
    if (!mems || mems.length === 0) throw redirect({ to: "/signup" });

    return { user: data.user };
  },
  component: () => <Outlet />,
});
