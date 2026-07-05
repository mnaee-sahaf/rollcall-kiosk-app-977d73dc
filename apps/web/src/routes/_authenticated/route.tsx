import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
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

    // Staff created with a temp password must set their own first.
    if (location.pathname !== "/app/set-password") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile?.must_change_password) throw redirect({ to: "/app/set-password" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
