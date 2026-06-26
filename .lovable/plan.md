
# RollCall Landing Page

A single-page marketing site matching the orange RollCall brand from the reference screenshots, with a waitlist signup and a "Try the demo" path.

## Visual direction

- Brand: "RollCall" wordmark — "Roll" in foreground, "Call" in orange (`#F97316`-ish), matches uploaded screenshots
- Palette: warm off-white background (`#fcfbf8`), near-black text, orange primary, soft orange tints for cards
- Typography: clean modern sans (Inter / Plus Jakarta), bold display headings
- Style: airy product-marketing layout, rounded cards, subtle shadows, small QR / kiosk illustrations using SVG (no heavy dependencies)

## Page sections (single route `/`)

1. **Top nav** — RollCall logo, anchor links (Features, How it works, FAQ), "Try the demo" ghost button, "Join waitlist" primary button
2. **Hero** — Headline "Attendance, taken in seconds.", subcopy about QR-based attendance for schools, two CTAs (Join waitlist / Try the demo), small trust line, decorative product mock card on the right showing a check-in tile
3. **Three marking methods** (the only three options the user listed):
   - Kiosk scan — device scans student QR
   - Self check-in — student scans class QR via companion app
   - Manual — teacher marks the digital roster
4. **How it works** — 3-step strip: Issue QR → Students check in → Reports generated
5. **Reports preview** — short section highlighting attendance reports (rate, breakdown, chronic absentees) with a simple stat card mock
6. **Waitlist CTA band** — email input + "Join waitlist" button, success toast on submit
7. **FAQ** — 4–5 short Q&A (data privacy, devices needed, rollout, pricing TBD)
8. **Footer** — wordmark, small links, copyright

## Waitlist behavior

For this first pass, the waitlist form stores entries in `localStorage` and shows a success toast ("You're on the list"). No backend yet — Lovable Cloud can be added later if the user wants real persistence + email notifications.

## "Try the demo" behavior

The "Try the demo" button links to `/demo`, a lightweight read-only mock of the admin dashboard from the reference screenshot (sidebar + stat cards + attendance chart placeholder + today's sessions list). Static data only — communicates the product without building real functionality.

## Routes

- `src/routes/index.tsx` — landing page (replaces placeholder)
- `src/routes/demo.tsx` — static demo dashboard
- Per-route `head()` with unique title + meta description + og tags

## Technical notes

- Tailwind v4 tokens added to `src/styles.css`: orange primary, surface tints, soft border, brand radius
- Components broken into `src/components/landing/*` (Nav, Hero, Methods, HowItWorks, ReportsPreview, WaitlistCTA, FAQ, Footer) and `src/components/demo/*` for the demo page
- Uses existing shadcn `button`, `input`, `card`, `accordion`, `sonner` (toast)
- No new dependencies

## Out of scope (ask later if wanted)

- Real waitlist persistence (Lovable Cloud) + admin export
- Companion app marketing detail / app store links
- Pricing page
