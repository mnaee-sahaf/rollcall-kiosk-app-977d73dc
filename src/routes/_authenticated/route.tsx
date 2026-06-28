import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // If the user has no role yet, send them to the welcome chooser so they
    // can create or join an org. /app/onboarding handles the post-create wizard.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const hasRole = (roles ?? []).length > 0;
    if (!hasRole && !location.pathname.startsWith("/welcome")) {
      throw redirect({ to: "/welcome" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
