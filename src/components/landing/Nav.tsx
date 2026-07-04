import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function Nav() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // getSession() reads localStorage (no network) — enough to switch the CTAs.
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#methods" className="hover:text-foreground">Methods</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#reports" className="hover:text-foreground">Reports</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/demo">Try the demo</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/app">Go to dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/demo">Try the demo</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup">Create organization</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
