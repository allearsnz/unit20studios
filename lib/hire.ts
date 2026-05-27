export type HireService = {
  slug: string;
  nav: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  body: string;
  gear: { name: string; spec: string }[];
  priceNote: string;
  faqs: { q: string; a: string }[];
  related: string[];
  gradient: string;
};

export const HIRE_SERVICES: HireService[] = [
  {
    slug: "cdj-hire-christchurch",
    nav: "CDJ hire",
    h1: "CDJ hire in Christchurch",
    metaTitle: "CDJ hire Christchurch — Pioneer CDJ-3000",
    metaDescription:
      "Hire Pioneer CDJ-3000 multi-players in Christchurch for your party, club night or event. Delivered or collected, set up ready to play. Day & weekend rates on request.",
    intro:
      "Pioneer CDJ-3000s — the same flagship players that run the studio booth — available to hire across Christchurch. Whether it's a flat party, a club fill-in or a festival stage, you get gear DJs actually want to touch.",
    body:
      "We hire in pairs or as part of a full booth with a mixer. Everything is tested before it leaves and arrives clean, linked and ready to play off USB. If you've never patched a setup, we'll talk you through it on drop-off — or set the whole thing up for you.",
    gear: [
      { name: "Pioneer CDJ-3000", spec: "9-inch touchscreen, 8 hot cues, beat jump, key sync. Up to 4 linked." },
      { name: "Pro DJ Link cabling", spec: "LAN linking so cues, BPM and quantise share across the players." },
      { name: "USB-ready", spec: "Plays rekordbox or Serato exports straight off a stick. No laptop needed." },
    ],
    priceNote: "Day & weekend rates on request — tell us the dates and we'll quote.",
    faqs: [
      { q: "Do you deliver and set up?", a: "Yes — we deliver across greater Christchurch, set up and test, then collect afterwards. Self-collection from the studio is also fine if you'd rather save on delivery." },
      { q: "Is there a deposit or bond?", a: "For hires we take a refundable bond and ID on collection or delivery. The amount depends on the package; we'll confirm it in your quote." },
      { q: "What's included?", a: "The players, all link and power cabling, and a quick rundown on setup. Add a mixer or full PA to make it a complete booth." },
      { q: "How far in advance should I book?", a: "Weekends book out, so the earlier the better — but get in touch any time and we'll tell you what's free." },
      { q: "Can you set it up at the venue?", a: "Yes. We can deliver, install and patch everything in, then strike it at the end of the night. Just let us know the venue and run time." },
    ],
    related: ["djm-hire-christchurch", "pa-hire-christchurch", "lighting-hire-christchurch"],
    gradient: "radial-gradient(120% 120% at 20% 10%, rgba(61,220,151,0.16), transparent 55%), linear-gradient(160deg,#141414,#0b0b0b)",
  },
  {
    slug: "djm-hire-christchurch",
    nav: "Mixer hire",
    h1: "DJ mixer hire in Christchurch",
    metaTitle: "DJ mixer hire Christchurch — Pioneer DJM",
    metaDescription:
      "Hire a Pioneer DJM club mixer in Christchurch — DJM-A9 and DJM-900NXS2. The club-standard board for parties, nights and events. Rates on request.",
    intro:
      "The mixer is the heart of the booth. We hire Pioneer DJM boards — the club standard — so your DJs are on faders and FX they already know, not fighting unfamiliar gear.",
    body:
      "Pair a mixer with our CDJ-3000s for a complete four-channel booth, or hire the board on its own to slot into a venue's existing setup. Every unit is serviced, cleaned and tested before it goes out.",
    gear: [
      { name: "Pioneer DJM-A9", spec: "Flagship 4-channel club mixer. Twin USB-C, Send/Return, the full FX suite." },
      { name: "Pioneer DJM-900NXS2", spec: "The industry workhorse. Found in booths worldwide — instantly familiar." },
      { name: "Cabling & RCA", spec: "All channel, master and booth cabling supplied. Ready to patch into any rig." },
    ],
    priceNote: "Day & weekend rates on request — bundle with CDJs for a full booth.",
    faqs: [
      { q: "Which mixer will I get?", a: "Tell us your preference — DJM-A9 or DJM-900NXS2 — and we'll allocate based on availability for your dates." },
      { q: "Can I hire it with CDJs?", a: "Absolutely. A pair of CDJ-3000s plus a DJM is our most popular package — a complete club booth, delivered." },
      { q: "Do you deliver?", a: "Yes, across Christchurch, with setup and collection. Self-collection from the studio is also available." },
      { q: "Is a bond required?", a: "A refundable bond and ID apply on hire. We'll set the amount in your quote based on the gear." },
      { q: "What's included?", a: "The mixer, power and all audio cabling, and a setup rundown. Add players, PA or lighting for a full event package." },
    ],
    related: ["cdj-hire-christchurch", "pa-hire-christchurch", "sound-hire-christchurch"],
    gradient: "radial-gradient(120% 120% at 80% 15%, rgba(245,241,234,0.07), transparent 55%), linear-gradient(160deg,#161616,#0c0c0c)",
  },
  {
    slug: "pa-hire-christchurch",
    nav: "PA hire",
    h1: "PA hire in Christchurch",
    metaTitle: "PA hire Christchurch — speakers & subs",
    metaDescription:
      "PA system hire in Christchurch for parties, events and club nights. Tops, subs and amps sized to your room and crowd. Delivery, setup and rates on request.",
    intro:
      "Sound that fills the room without flattening it. We hire PA systems sized to your space — from a backyard party to a warehouse night — with the subs to make it move and the headroom to keep it clean.",
    body:
      "Not sure what you need? Tell us the room, the crowd size and the kind of night, and we'll spec a system that's right — never under-powered, never overkill. We can deliver, install, tune it to the room and collect after.",
    gear: [
      { name: "Full-range tops", spec: "Active PA tops on stands — clear vocals, tight highs, even coverage." },
      { name: "Subwoofers", spec: "Add low end that you feel. Sized to the room so it's weight, not mud." },
      { name: "Amps, desk & cabling", spec: "Powering, a compact mixer if you need it, and all the cabling to tie it together." },
    ],
    priceNote: "Quoted per event — we size the rig to your room and dates.",
    faqs: [
      { q: "How do I know what size PA I need?", a: "Just tell us the venue or room size and rough headcount. We'll recommend a system with enough headroom to stay clean all night." },
      { q: "Do you deliver and set up?", a: "Yes — delivery, setup, room tuning and collection across Christchurch. Self-collection is available for smaller systems." },
      { q: "Can you tune it to the venue?", a: "We can set up and tune the system on site so it sits right in the space before doors. Recommended for anything bigger than a flat party." },
      { q: "Is a bond needed?", a: "A refundable bond and ID apply. The amount scales with the size of the package and we confirm it in the quote." },
      { q: "Can I add DJ gear?", a: "Yes — pair the PA with CDJs, a mixer and lighting for a complete event package from one supplier." },
    ],
    related: ["sound-hire-christchurch", "lighting-hire-christchurch", "cdj-hire-christchurch"],
    gradient: "radial-gradient(120% 120% at 30% 90%, rgba(61,220,151,0.14), transparent 55%), linear-gradient(160deg,#141414,#0b0b0b)",
  },
  {
    slug: "sound-hire-christchurch",
    nav: "Sound hire",
    h1: "Sound equipment hire in Christchurch",
    metaTitle: "Sound hire Christchurch — mics, monitors, AV",
    metaDescription:
      "Sound and AV equipment hire in Christchurch — microphones, monitors, DI boxes and cabling for events, launches and live sets. Rates and packages on request.",
    intro:
      "Beyond the booth: the microphones, monitoring and bits that make an event actually work. Speeches, live sets, launches — we've got the sound gear to cover it.",
    body:
      "Hire individual pieces to round out your own rig, or let us put together a complete package. Everything is tested and cabled so you're not scrambling for an adaptor ten minutes before doors.",
    gear: [
      { name: "Microphones", spec: "Wired and wireless handhelds for speeches, MCs and live vocals." },
      { name: "Stage monitors", spec: "Foldback wedges so performers can actually hear themselves." },
      { name: "DI boxes & cabling", spec: "DIs, XLR, jack and the adaptors that always go missing. All supplied." },
    ],
    priceNote: "Per-item or package rates on request.",
    faqs: [
      { q: "Can I hire just a microphone?", a: "Yes — individual items are fine. Tell us what you're missing and we'll sort it. Minimum hire periods may apply for small items." },
      { q: "Do you deliver?", a: "Delivery and collection across Christchurch, or self-collect from the studio for smaller orders." },
      { q: "Can you supply a full event package?", a: "Yes — combine sound gear with PA, DJ equipment and lighting for one quote, one supplier, one drop-off." },
      { q: "Is a deposit required?", a: "A refundable bond and ID apply on hire, scaled to the package and confirmed in your quote." },
      { q: "What if I'm not sure what I need?", a: "Tell us the event and we'll spec it. We'd rather get it right than have you guess." },
    ],
    related: ["pa-hire-christchurch", "djm-hire-christchurch", "lighting-hire-christchurch"],
    gradient: "radial-gradient(120% 120% at 75% 80%, rgba(245,241,234,0.07), transparent 55%), linear-gradient(160deg,#161616,#0c0c0c)",
  },
  {
    slug: "lighting-hire-christchurch",
    nav: "Lighting hire",
    h1: "Event lighting hire in Christchurch",
    metaTitle: "Lighting hire Christchurch — event & club",
    metaDescription:
      "Event and club lighting hire in Christchurch — pars, moving heads, haze and control. Set the room right for your night. Delivery, install and rates on request.",
    intro:
      "Lighting is the difference between a room with music in it and a night. We hire club and event lighting — colour, movement and haze — to give your space the right energy after dark.",
    body:
      "From a few pars to wash a back wall, to moving heads and haze for a proper club feel, we'll spec lighting to match the room and the vibe. We can deliver, rig, program a simple look and strike it after.",
    gear: [
      { name: "LED par cans", spec: "Colour wash for walls, stages and dance floors. Punchy and low-heat." },
      { name: "Moving heads", spec: "Beams and spots for movement and energy across the room." },
      { name: "Haze & control", spec: "A hazer to make beams read, plus simple control so the look runs itself." },
    ],
    priceNote: "Quoted per event — sized and rigged to your venue.",
    faqs: [
      { q: "Do you install the lighting?", a: "We can deliver, rig, program a basic look and strike it after the night — recommended for moving heads and anything rigged at height." },
      { q: "Can I run it myself?", a: "For simple par setups, yes — we'll set a look and show you the control. For bigger rigs we'd suggest we handle it." },
      { q: "Do you need a hazer for the beams to show?", a: "For moving-head beams to read in the air, yes — a little haze makes a big difference. We include one in most lighting packages." },
      { q: "Is a bond required?", a: "A refundable bond and ID apply on hire, scaled to the package and confirmed in your quote." },
      { q: "Can I add sound and DJ gear?", a: "Yes — lighting pairs with PA, sound and DJ equipment for a complete event package from one supplier." },
    ],
    related: ["pa-hire-christchurch", "cdj-hire-christchurch", "sound-hire-christchurch"],
    gradient: "radial-gradient(120% 120% at 25% 15%, rgba(229,72,77,0.14), transparent 55%), linear-gradient(160deg,#15100f,#0b0b0b)",
  },
];

export function getHireService(slug: string): HireService | undefined {
  return HIRE_SERVICES.find((s) => s.slug === slug);
}
