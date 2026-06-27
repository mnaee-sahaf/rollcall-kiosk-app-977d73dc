import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSettings, updateSettings } from "@/lib/settings.functions";
import { getMyContext } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const fCtx = useServerFn(getMyContext);
  const fGet = useServerFn(getSettings);
  const fUpdate = useServerFn(updateSettings);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [cutoff, setCutoff] = useState("09:00");
  const [absentAfter, setAbsentAfter] = useState("10:30");
  const [tz, setTz] = useState("UTC");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fCtx({}).then((c) => {
      if (!c.isAdmin) navigate({ to: "/app" });
    });
    fGet({}).then((s) => {
      if (s) {
        setName(s.school_name ?? "");
        setLogoUrl(s.logo_url ?? null);
        setCutoff((s.day_cutoff_time ?? "09:00").slice(0, 5));
        setAbsentAfter((s.absent_after_time ?? "10:30").slice(0, 5));
        setTz(s.timezone ?? "UTC");
      }
      setLoading(false);
    });
  }, [fCtx, fGet, navigate]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fUpdate({
        data: {
          school_name: name || null,
          logo_url: logoUrl,
          day_cutoff_time: cutoff,
          absent_after_time: absentAfter,
          timezone: tz,
        },
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("school-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("school-assets")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signed?.signedUrl) {
        setLogoUrl(signed.signedUrl);
        toast.success("Logo uploaded — click Save to apply");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="p-8">Loading…</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">School settings</h1>
      <p className="text-muted-foreground mb-8">Branding and attendance rules for your school.</p>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Branding</h2>
          <div>
            <Label>School name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lincoln High School" />
          </div>
          <div>
            <Label>Logo</Label>
            <div className="flex items-center gap-4 mt-1">
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="h-16 w-16 rounded border object-contain bg-white" />
              ) : (
                <div className="h-16 w-16 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">No logo</div>
              )}
              <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border bg-white px-3 py-2 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload"}
                <input type="file" accept="image/*" hidden onChange={handleLogo} />
              </label>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Attendance rules</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Late after</Label>
              <Input type="time" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Scans after this time count as late.</p>
            </div>
            <div>
              <Label>Absent after</Label>
              <Input type="time" value={absentAfter} onChange={(e) => setAbsentAfter(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Unscanned students marked absent.</p>
            </div>
          </div>
          <div>
            <Label>Timezone</Label>
            <Input value={tz} onChange={(e) => setTz(e.target.value)} placeholder="America/New_York" />
          </div>
        </Card>

        <Button type="submit">
          <Save className="h-4 w-4 mr-2" /> Save settings
        </Button>
      </form>
    </div>
  );
}
