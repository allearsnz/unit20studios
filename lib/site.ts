/** Single source of truth for business + nav constants. */

export const site = {
  name: "Unit 20",
  legalName: "Unit 20 Studios",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://unit20.nz",
  email: process.env.RESEND_REPLY_TO ?? "studio@unit20.nz",
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "",
  tagline: "DJ practice studio, gear hire & venue",
  // INTEGRATION NOTE: the venue/events experience already lives on the existing
  // unit20.nz site. For now the hub + nav link out here. The unit20.nz dev will
  // integrate this Studio/Hire app + hub into that site.
  venueUrl: process.env.NEXT_PUBLIC_VENUE_URL ?? "https://unit20.nz",
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

export type NavLink = { label: string; href: string; external?: boolean };

export const primaryNav: NavLink[] = [
  { label: "Studio", href: "/studio" },
  { label: "Hire", href: "/hire" },
  { label: "Venue / Events", href: site.venueUrl, external: true },
  { label: "About", href: "/about" },
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
      { label: "DJ equipment", href: "/hire#dj-equipment" },
      { label: "Sound equipment", href: "/hire#sound-equipment" },
      { label: "Lighting", href: "/hire#lighting-equipment" },
      { label: "Full production", href: "/hire#full-production" },
    ],
  },
  {
    title: "Visit",
    links: [
      { label: "Venue / Events", href: site.venueUrl, external: true },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
];
