import type { ProductCategory } from "./products";

export type HireService = {
  slug: string;
  title: string;        // H1
  shortTitle: string;   // for /hire index cards
  description: string;  // meta description (under 160 chars)
  lede: string;         // hero lede
  fromLabel: string;    // "From $70+GST/day"
  categories: ProductCategory[];
  showLargerSystems: boolean;
  /** Unique on-page copy block after the hero — keeps each landing page distinct. */
  intro?: { title: string; paragraphs: string[] };
  /** Per-service override for the speakers/subs section heading + lead. */
  paSection?: { title: string; lead: string };
  /** Enquiry-led section for gear quoted per job rather than listed day rates. */
  enquire?: { eyebrowLabel: string; title: string; lead: string; subject: string };
  /** Service-specific FAQs, shown (and marked up) ahead of the shared hire FAQs. */
  extraFaqs?: { q: string; a: string }[];
};

export const HIRE_SERVICES: HireService[] = [
  {
    slug: "cdj-hire-christchurch",
    title: "CDJ hire Christchurch",
    shortTitle: "CDJs, mixers & PA",
    description:
      "Pioneer DJ CDJ-3000, DJM-A9, XDJ-RX2 and PA hire in Christchurch. Day rates from $70+GST. Email or call to book.",
    lede:
      "Industry-standard Pioneer DJ gear and PA, by the day. Delivered or picked up.",
    fromLabel: "From $125+GST/day",
    categories: ["dj-player", "dj-mixer", "dj-all-in-one", "speaker", "subwoofer"],
    showLargerSystems: true,
    intro: {
      title: "The same players you'll meet in the booth",
      paragraphs: [
        "CDJ-3000s linked over Pro DJ Link, a DJM-A9 or DJM-900NXS2 to mix on, and an XDJ-RX2 when you want two decks and a mixer in one unit with no laptop. It's the setup Christchurch club booths run, so what you hire is what you already know.",
        "Hire a single player, a pair with a mixer, or a full booth with PA — delivered and picked up within Christchurch, or collect it yourself. Want practice time first? The same gear is bookable by the hour at the Unit 20 studio.",
      ],
    },
    extraFaqs: [
      {
        q: "Do I need to bring a laptop?",
        a: "No — the CDJ-3000 and CDJ-2000NXS2 play from USB or SD and are rekordbox, Serato and VirtualDJ ready. Bring your music on a stick or plug in a laptop, either works.",
      },
      {
        q: "Can I hire a full DJ booth setup?",
        a: "Yes. Two or four players, a DJM mixer, and PA to match — tell us the gig and we'll package it. Multi-unit and multi-day rates on enquiry.",
      },
    ],
  },
  {
    slug: "djm-hire-christchurch",
    title: "DJM hire Christchurch",
    shortTitle: "DJ mixers",
    description:
      "Pioneer DJ DJM-A9 and DJM-900NXS2 hire in Christchurch. Day rates from $125+GST. Email or call to book.",
    lede:
      "Pioneer DJ flagship 4-channel mixers, current and previous generation. Day rates below.",
    fromLabel: "From $125+GST/day",
    categories: ["dj-mixer"],
    showLargerSystems: false,
    intro: {
      title: "A9 or 900NXS2?",
      paragraphs: [
        "Both are 4-channel club mixers with Sound Color FX, Beat FX and MAGVEL faders. The DJM-A9 is the current flagship — 96 kHz / 64-bit float engine, Bluetooth input and an X-Pad for the FX. The DJM-900NXS2 is the club workhorse from the generation before, rekordbox dvs ready with dual USB for laptop switching.",
        "Need players to go with it? See our CDJ hire page, or ask for a full booth package with PA.",
      ],
    },
  },
  {
    slug: "pa-hire-christchurch",
    title: "PA hire Christchurch",
    shortTitle: "PA & speakers",
    description:
      "Active PA hire in Christchurch — QSC K12.2, LD Systems ICOA, QSC KS118 sub. From $70+GST/day. Line arrays on enquiry.",
    lede:
      "Active QSC and LD Systems boxes for events of any size, from a single Bluetooth top to a full line-array rig.",
    fromLabel: "From $70+GST/day",
    categories: ["speaker", "subwoofer"],
    showLargerSystems: true,
    intro: {
      title: "Which box do you need?",
      paragraphs: [
        "For a straightforward party with playlists off a phone, the LD Systems ICOA 12 has Bluetooth and a 4-channel mixer built in — no extra kit needed. For DJs and live sound, the QSC K12.2 is a 2000-watt top that comes with a tripod stand and doubles as a floor wedge.",
        "Add a QSC KS118 18-inch sub when the low end matters — it pairs with the K12.2 for a compact club-ready rig, and runs cardioid in stereo pairs. All rates are per day, +GST, with multi-day discounts available.",
      ],
    },
    paSection: {
      title: "Active tops and subs, by the day",
      lead: "Every box is powered — no separate amps to cart. Stand included with the K12.2.",
    },
  },
  {
    slug: "sound-hire-christchurch",
    title: "Sound hire Christchurch",
    shortTitle: "Sound systems",
    description:
      "Sound system hire for events, gigs and parties across Christchurch and Canterbury — QSC, LD Systems and RCF rigs, delivered and set up.",
    lede:
      "PA and sound system hire for events, festivals, clubs and private parties across Christchurch and Canterbury.",
    fromLabel: "From $70+GST/day",
    categories: ["speaker", "subwoofer"],
    showLargerSystems: true,
    intro: {
      title: "Sound for the whole event, not just the boxes",
      paragraphs: [
        "Tell us the location, the headcount and what's playing, and we'll spec a system that fits — a single powered speaker for a backyard birthday, tops and subs for a club night, or RCF HDL 30 line arrays for festival stages. Delivery, setup and pack-down within Christchurch are part of the job.",
        "Through All Ears we can also run the whole night: sound tech on the desk, lighting, staging and backline, on the ground in Christchurch and across the South Island. One supplier, one quote.",
      ],
    },
    paSection: {
      title: "The core rig",
      lead: "QSC and LD Systems powered boxes that cover most gigs — scale up from here with extra tops, subs or a line array.",
    },
    extraFaqs: [
      {
        q: "Can you supply a sound tech with the system?",
        a: "Yes. We run full event production through All Ears — sound techs, lighting, staging and crew. Mention it in your enquiry and we'll include it in the quote.",
      },
      {
        q: "What size events can you cover?",
        a: "Anything from a single Bluetooth speaker for a backyard party up to festival stages on RCF HDL 30 line arrays and TTL6 systems. Give us the location and headcount and we'll spec it.",
      },
    ],
  },
  {
    slug: "backline-hire-christchurch",
    title: "Backline hire Christchurch",
    shortTitle: "Backline",
    description:
      "Backline hire for gigs and events in Christchurch — packages quoted to your rider, with foldback and PA from $70+GST/day. Email or call for a quote.",
    lede:
      "Backline for gigs, festivals and events across Christchurch, quoted to your rider. Delivery and pickup included with most full backline hires.",
    fromLabel: "Quoted to your rider",
    categories: ["speaker", "subwoofer"],
    showLargerSystems: true,
    intro: {
      title: "One supplier for the whole stage",
      paragraphs: [
        "Backline is quoted per job rather than off a rate card — every rider is different. Send us your tech rider or a plain list of what the acts need, with the location and dates, and we'll come back with a package and a price.",
        "Because we also run sound, lighting and staging through All Ears, backline can land as part of one production quote instead of another supplier to chase — for club shows, festivals, brand activations and private events across Christchurch and the South Island.",
      ],
    },
    paSection: {
      title: "Foldback and front of house",
      lead: "Active QSC tops that double as floor wedges, plus an 18-inch sub for front of house. Day rates below — or we fold them into the backline quote.",
    },
    enquire: {
      eyebrowLabel: "Backline",
      title: "Send us the rider",
      lead: "Amps, kits, keys, stands — tell us what the stage needs and we'll quote a full backline package. Include the location, dates and a rough set count, and mention if you want us on sound or lights for the night too.",
      subject: "Backline hire enquiry",
    },
    extraFaqs: [
      {
        q: "Is delivery included with backline hire?",
        a: "Delivery and pickup within Christchurch are included with most full backline hires. For single items we'll confirm delivery or pickup when we quote.",
      },
      {
        q: "Can you run production for the whole show?",
        a: "Yes — sound, lighting, staging, backline and crew through All Ears, with one quote for the lot. Festivals, club shows, brand activations and private parties.",
      },
    ],
  },
  {
    slug: "lighting-hire-christchurch",
    title: "Lighting hire Christchurch",
    shortTitle: "Lighting",
    description:
      "Lighting hire for events in Christchurch — moving heads, washes, hazers, controllers. Get in touch for current inventory.",
    lede:
      "Lighting fixtures and control for events across Christchurch. Detailed fixture list coming soon.",
    fromLabel: "Enquire",
    categories: [],
    showLargerSystems: false,
    enquire: {
      eyebrowLabel: "Fixtures",
      title: "Inventory list coming soon",
      lead: "Detailed fixture list is being finalised. For now, please get in touch with your event details — location, dates, rough headcount, and the look you're after — and we'll spec a package.",
      subject: "Lighting hire enquiry",
    },
  },
];

export function getHireService(slug: string): HireService | undefined {
  return HIRE_SERVICES.find((s) => s.slug === slug);
}
