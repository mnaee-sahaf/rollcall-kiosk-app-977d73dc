import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            QR-based attendance for schools. Built to disappear into the school day.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <a href="#methods" className="hover:text-foreground">Methods</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#reports" className="hover:text-foreground">Reports</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
          <a href="#waitlist" className="hover:text-foreground">Waitlist</a>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} RollCall. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
