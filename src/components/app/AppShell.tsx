import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  GraduationCap,
  BarChart3,
  Users,
  LogOut,
  Settings,
  Upload,
  UserSquare2,
  Menu,
  Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/landing/Logo";
import { OrgSwitcher } from "@/components/app/OrgSwitcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function AppShell({
  children,
  isAdmin,
}: {
  children: ReactNode;
  isAdmin: boolean;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
      active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted"
    }`;

  const Nav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1" onClick={onNavigate}>
      <Link to="/app" className={linkClass(pathname === "/app")}>
        <LayoutDashboard className="h-4 w-4" /> Dashboard
      </Link>
      <Link to="/app/classes" className={linkClass(pathname.startsWith("/app/classes"))}>
        <GraduationCap className="h-4 w-4" /> Classes
      </Link>
      <Link to="/app/reports" className={linkClass(pathname.startsWith("/app/reports"))}>
        <BarChart3 className="h-4 w-4" /> Reports
      </Link>
      {isAdmin && (
        <>
          <div className="mt-4 mb-1 px-3 text-[10px] uppercase tracking-wide text-muted-foreground">
            Admin
          </div>
          <Link to="/app/students" className={linkClass(pathname.startsWith("/app/students"))}>
            <UserSquare2 className="h-4 w-4" /> All students
          </Link>
          <Link to="/app/teachers" className={linkClass(pathname.startsWith("/app/teachers"))}>
            <Users className="h-4 w-4" /> Teachers
          </Link>
          <Link to="/app/import" className={linkClass(pathname.startsWith("/app/import"))}>
            <Upload className="h-4 w-4" /> Bulk import
          </Link>
          <Link to="/app/waitlist" className={linkClass(pathname.startsWith("/app/waitlist"))}>
            <Mail className="h-4 w-4" /> Waitlist
          </Link>
          <Link to="/app/settings" className={linkClass(pathname.startsWith("/app/settings"))}>
            <Settings className="h-4 w-4" /> Settings
          </Link>
        </>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-[#fcfbf8]">
      <aside className="hidden md:flex w-60 flex-col border-r bg-white px-4 py-6">
        <Link to="/" className="mb-6 px-2">
          <Logo />
        </Link>
        <div className="mb-6">
          <OrgSwitcher />
        </div>
        <Nav />
        <div className="mt-auto">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-white px-4 py-3">
          <Link to="/">
            <Logo />
          </Link>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-5">
              <div className="mb-6">
                <Logo />
              </div>
              <div className="mb-6">
                <OrgSwitcher />
              </div>
              <Nav onNavigate={() => setMobileOpen(false)} />
              <div className="mt-6 pt-4 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
