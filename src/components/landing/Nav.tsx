import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";

export function Nav() {
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
          <Button asChild variant="ghost" size="sm">
            <Link to="/demo">Try the demo</Link>
          </Button>
          <Button asChild size="sm">
            <a href="#waitlist">Join waitlist</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
