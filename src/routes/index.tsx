import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Methods } from "@/components/landing/Methods";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ReportsPreview } from "@/components/landing/ReportsPreview";
import { WaitlistCTA } from "@/components/landing/WaitlistCTA";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RollCall — QR attendance for schools" },
      { name: "description", content: "Take attendance in seconds with QR-based kiosk scans, student self check-in, or a manual roster. Live reports, chronic absentee alerts, and one clean workflow." },
      { property: "og:title", content: "RollCall — QR attendance for schools" },
      { property: "og:description", content: "QR-based attendance for K–12 and higher-ed. Kiosk scan, self check-in, or manual roster — all in one clean report." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <Methods />
        <HowItWorks />
        <ReportsPreview />
        <WaitlistCTA />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
