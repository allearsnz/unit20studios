/** Single source of truth for business + nav constants. */

export const site = {
  name: "Unit 20",
  legalName: "Unit 20 Studios",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://studio.unit20.nz",
  email: process.env.RESEND_REPLY_TO ?? "studio@unit20.nz",
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "",
  tagline: "DJ studio and equipment hire in Christchurch",
  // Unit 20 Live — the shows/ticketing side, kept as a plain outbound link.
  // This site is the studio only; nothing here describes or promotes Live.
  liveUrl: process.env.NEXT_PUBLIC_LIVE_URL ?? "https://unit20.nz",
  address: {
    street: "20 Southwark Street",
    locality: "Christchurch Central",
    region: "Canterbury",
    postalCode: "8011",
    country: "NZ",
    countryName: "Aotearoa New Zealand",
  },
  geo: { lat: -43.5365, lng: 172.6336 },
  social: {
    instagram: "https://instagram.com/unit20.nz",
  },
} as const;

export type NavLink = {
  label: string;
  href: string;
  external?: boolean;
  /** Extra path prefix that should also light this item up as current. */
  activePrefix?: string;
};

export const primaryNav: NavLink[] = [
  { label: "Studio", href: "/", activePrefix: "/studio" },
  { label: "Hire", href: "/hire" },
  { label: "Live", href: site.liveUrl, external: true },
  { label: "About", href: "/about" },
  { label: "Account", href: "/account" },
  { label: "Contact", href: "/contact" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "The Studio",
    links: [
      { label: "Pricing", href: "/studio/pricing" },
      { label: "The room", href: "/studio/the-room" },
      { label: "Before you come", href: "/studio/info" },
      { label: "Book a session", href: "/studio/book" },
    ],
  },
  {
    title: "Hire",
    links: [
      { label: "CDJ hire", href: "/hire/cdj-hire-christchurch" },
      { label: "Sound hire", href: "/hire/sound-hire-christchurch" },
      { label: "PA hire", href: "/hire/pa-hire-christchurch" },
      { label: "Backline hire", href: "/hire/backline-hire-christchurch" },
      { label: "Lighting hire", href: "/hire/lighting-hire-christchurch" },
      { label: "Full production", href: "/hire#full-production" },
    ],
  },
  {
    title: "More",
    links: [
      { label: "My account", href: "/account" },
      { label: "Live", href: site.liveUrl, external: true },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
];
