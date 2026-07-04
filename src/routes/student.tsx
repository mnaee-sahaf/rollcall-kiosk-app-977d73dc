import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/landing/Logo";

export const Route = createFileRoute("/student")({
  ssr: false,
  component: StudentEntry,
});

function StudentEntry() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (c.length < 4) return;
    navigate({ to: "/lookup/$qrToken", params: { qrToken: c } });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcfbf8] px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-sm text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-2xl font-bold">Check your attendance</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your student code, or scan the QR on your card to open your attendance directly.
        </p>
        <form onSubmit={go} className="mt-6 space-y-4 text-left">
          <div>
            <Label htmlFor="code">Student code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste the code from your card"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={code.trim().length < 4}>
            View my attendance
          </Button>
        </form>
      </div>
    </div>
  );
}
