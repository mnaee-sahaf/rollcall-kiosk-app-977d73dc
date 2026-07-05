import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "What hardware do we need?",
    a: "For kiosk scan, any tablet or laptop with a camera works at the classroom door. For self check-in, students use the companion app on their own phone. Manual roster works on any device.",
  },
  {
    q: "Can QR codes be reused or copied?",
    a: "Personal student badges are unique and revocable. Class QR codes rotate to prevent screenshot-sharing, and duplicate scans can be ignored, warned, or overwritten per school policy.",
  },
  {
    q: "How long does rollout take?",
    a: "Pilot schools are typically up and running within a week — bulk-import your roster, print badges, and you're live the next school day.",
  },
  {
    q: "Is student data private?",
    a: "Yes. Attendance data stays in your school's workspace. We follow standard education-data privacy practices and never sell or share student information.",
  },
  {
    q: "What does it cost?",
    a: "Pilot cohorts are free during the program. Paid plans roll out after the pilot — waitlist members get founding-school pricing.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">FAQ</div>
        <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Common questions</h2>
      </div>
      <Accordion type="single" collapsible className="mt-10">
        {faqs.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-left text-base font-semibold">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
