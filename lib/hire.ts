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
  },
  {
    slug: "sound-hire-christchurch",
    title: "Sound hire Christchurch",
    shortTitle: "Sound systems",
    description:
      "PA and sound system hire across Christchurch and Canterbury. QSC, LD Systems and RCF rigs. Email or call to book.",
    lede:
      "PA and sound system hire for events, festivals, clubs and private parties across Christchurch and Canterbury.",
    fromLabel: "From $70+GST/day",
    categories: ["speaker", "subwoofer"],
    showLargerSystems: true,
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
  },
];

export function getHireService(slug: string): HireService | undefined {
  return HIRE_SERVICES.find((s) => s.slug === slug);
}
