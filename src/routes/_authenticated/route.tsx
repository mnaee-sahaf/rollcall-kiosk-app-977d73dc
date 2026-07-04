import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // If the user has no role yet, send them to the signup wizard so they can
    // create or join an organization.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const hasRole = (roles ?? []).length > 0;
    if (!hasRole) {
      throw redirect({ to: "/signup" });
    }

    // Teachers created by an admin get a temp password and must set their own
    // before reaching anything else. Server-enforced here, not just in the UI.
    if (hasRole && location.pathname !== "/app/set-password") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile?.must_change_password) {
        throw redirect({ to: "/app/set-password" });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
