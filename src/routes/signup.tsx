import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createOrganization } from "@/lib/organization.functions";
import { Logo } from "@/components/landing/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Smartphone,
  Monitor,
  ClipboardList,
  QrCode,
  Check,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { getCountryFlag } from "@/lib/countryFlags";

export const Route = createFileRoute("/signup")({
  ssr: false,
  component: SignupWizard,
});

const INDUSTRIES = [
  "K-12 school",
  "Higher education",
  "After-school program",
  "Tutoring center",
  "Training / corporate",
  "Other",
];

const ORG_SIZES = ["1–10", "11–50", "51–200", "201–500", "501–1,000", "1,000+"];

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Congo-Brazzaville)", "Costa Rica",
  "Croatia", "Cuba", "Cyprus", "Czechia", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador",
  "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
  "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar",
  "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
  "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan",
  "Palau", "Palestine State", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
  "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
  "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan",
  "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela",
  "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

const ROLES = [
  "Principal / Head of school",
  "Administrator",
  "IT / Operations",
  "Teacher",
  "Other",
];

const DEVICES = [
  { id: "kiosk", label: "Shared kiosk", desc: "A class device scans student QRs", icon: QrCode },
  { id: "web", label: "Web browser", desc: "Teachers mark attendance on a digital roster", icon: Monitor },
  { id: "mobile", label: "Mobile companion app", desc: "Students scan a class QR with their phone", icon: Smartphone },
  { id: "roster", label: "Manual digital roster", desc: "Mark present/absent by hand", icon: ClipboardList },
];

const REFERRAL_SOURCES = [
  "Search engine",
  "A friend or colleague",
  "Social media",
  "App store",
  "Review website",
  "Other",
];

type Phase = "loading" | "wizard";

function SignupWizard() {
  const navigate = useNavigate();
  const createOrg = useServerFn(createOrganization);

  const [phase, setPhase] = useState<Phase>("loading");
  // When resuming (account already created, org not yet), skip the account step.
  const [resuming, setResuming] = useState(false);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Org profile
  const [schoolName, setSchoolName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [orgSize, setOrgSize] = useState("");
  const [role, setRole] = useState("");
  const [devices, setDevices] = useState<string[]>([]);
  const [referralSource, setReferralSource] = useState("");

  useEffect(() => {
    // Signup is always open (multi-tenant). If already signed in, this is
    // someone creating an ADDITIONAL org — skip the account step.
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user) {
          setResuming(true);
          setEmail(data.user.email ?? "");
          setStep(2);
        }
        setPhase("wizard");
      })
      .catch(() => setPhase("wizard"));
  }, []);

  function toggleDevice(id: string) {
    setDevices((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  }

  const accountValid =
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) &&
    password.length >= 8 &&
    fullName.trim().length > 0;
  const orgValid =
    schoolName.trim().length >= 2 &&
    country.trim().length > 0 &&
    phone.trim().length > 0 &&
    industry.trim().length > 0 &&
    orgSize.trim().length > 0 &&
    role.trim().length > 0;
  const devicesValid = devices.length > 0;
  const referralValid = referralSource.length > 0;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      if (!resuming) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
      }
      await createOrg({
        data: {
          schoolName: schoolName.trim(),
          country: country || null,
          phone: phone || null,
          industry: industry || null,
          orgSize: orgSize || null,
          role: role || null,
          devices,
          referralSource: referralSource || null,
        },
      });
      toast.success("Organization created");
      navigate({ to: "/app", search: { welcome: 1 }, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create organization");
      setSubmitting(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfbf8] text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const totalSteps = 4;

  return (
    <div className="min-h-screen bg-[#fcfbf8]">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/">
            <Logo />
          </Link>
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
            Already have an account? Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10 md:py-14">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  step === n
                    ? "bg-primary text-primary-foreground"
                    : step > n
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > n ? <Check className="h-3 w-3" /> : n}
              </div>
              {n < totalSteps && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
          <span className="ml-2">Step {step} of {totalSteps}</span>
        </div>

        {step === 1 && (
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> You'll be the administrator
            </div>
            <h1 className="mt-3 text-2xl font-bold">Create your school's Jibble RollCall</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This creates a new organization. The account you make here is the admin account —
              you'll add teacher logins afterward.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="fullName">Your full name *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jordan Rivera"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="email">Work email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button size="lg" disabled={!accountValid} onClick={() => setStep(2)}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Building2 className="h-3.5 w-3.5" /> Organization details
            </div>
            <h1 className="mt-3 text-2xl font-bold">Tell us about your school</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Help us tailor Jibble RollCall to your organization.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <Label htmlFor="org">Organization / school name *</Label>
                <Input
                  id="org"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Lincoln High School"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger id="country"><SelectValue placeholder="Select a country" /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          <span className="mr-2">{getCountryFlag(c)}</span>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
                </div>
              </div>
              <div>
                <Label>Industry / school type</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Organization size</Label>
                  <Select value={orgSize} onValueChange={setOrgSize}>
                    <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent>
                      {ORG_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Your role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-between">
              {resuming ? (
                <span />
              ) : (
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
              <Button size="lg" disabled={!orgValid} onClick={() => setStep(3)}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold">How will your team mark attendance?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick one or more. You can change this anytime in settings.
            </p>

            <div className="mt-6 space-y-3">
              {DEVICES.map((d) => {
                const Icon = d.icon;
                const active = devices.includes(d.id);
                return (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => toggleDevice(d.id)}
                    className={`w-full text-left flex items-center gap-4 rounded-lg border p-4 transition ${
                      active ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{d.label}</div>
                      <div className="text-xs text-muted-foreground">{d.desc}</div>
                    </div>
                    <Checkbox checked={active} className="pointer-events-none" />
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button size="lg" disabled={!devicesValid} onClick={() => setStep(4)}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold">Where did you first hear about us?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional — helps us know what's working.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REFERRAL_SOURCES.map((s) => {
                const active = referralSource === s;
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setReferralSource(s)}
                    className={`rounded-lg border p-4 text-left transition ${
                      active ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{s}</span>
                      <span
                        className={`h-4 w-4 rounded-full border ${
                          active ? "border-primary bg-primary" : "border-muted-foreground/30"
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(3)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button size="lg" disabled={!referralValid || submitting} onClick={handleSubmit}>
                {submitting ? "Creating…" : "Create organization"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
