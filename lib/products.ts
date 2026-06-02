export type ProductCategory =
  | "dj-player"
  | "dj-mixer"
  | "dj-all-in-one"
  | "speaker"
  | "subwoofer";

export type Product = {
  slug: string;
  brand: string;
  model: string;
  name: string;
  category: ProductCategory;
  priceLabel: string;
  priceDailyCents: number;
  image: string;
  imageAspect: "landscape" | "portrait" | "square";
  shortDesc: string;
  bullets: string[];
  includedNote?: string;
  order: number;
};

export const PRODUCTS: Product[] = [
  // ---- DJ players ----
  {
    slug: "pioneer-dj-cdj-3000",
    brand: "Pioneer DJ",
    model: "CDJ-3000",
    name: "Pioneer DJ CDJ-3000",
    category: "dj-player",
    priceLabel: "$130+GST",
    priceDailyCents: 13000,
    image: "/hire/cdj-3000.png",
    imageAspect: "landscape",
    shortDesc: "Industry-standard club media player.",
    bullets: [
      "9-inch HD touchscreen",
      "High-res 96 kHz / 32-bit audio",
      "Pioneer Pro DJ Link, USB + SD",
      "Rekordbox / Serato / VirtualDJ ready",
    ],
    order: 1,
  },
  {
    slug: "pioneer-dj-cdj-2000nxs2",
    brand: "Pioneer DJ",
    model: "CDJ-2000NXS2",
    name: "Pioneer DJ CDJ-2000NXS2",
    category: "dj-player",
    priceLabel: "$130+GST",
    priceDailyCents: 13000,
    image: "/hire/cdj-2000nxs2.png",
    imageAspect: "portrait",
    shortDesc: "Club-tier multi player, the generation before the CDJ-3000.",
    bullets: [
      "High-res 96 kHz / 24-bit audio",
      "Touch-strip + onboard Beat FX",
      "Pioneer Pro DJ Link, USB + SD",
      "Rekordbox / dvs / Serato",
    ],
    order: 2,
  },
  // ---- DJ mixers ----
  {
    slug: "pioneer-dj-djm-a9",
    brand: "Pioneer DJ",
    model: "DJM-A9",
    name: "Pioneer DJ DJM-A9",
    category: "dj-mixer",
    priceLabel: "$140+GST",
    priceDailyCents: 14000,
    image: "/hire/djm-a9.png",
    imageAspect: "landscape",
    shortDesc: "Flagship 4-channel pro DJ mixer.",
    bullets: [
      "4-channel, 96 kHz / 64-bit float engine",
      "Sound Color FX + Beat FX with X-Pad",
      "Bluetooth in, 4 phono / 4 line, 2x USB-B",
      "MAGVEL FADER PRO crossfader",
    ],
    order: 1,
  },
  {
    slug: "pioneer-dj-djm-900nxs2",
    brand: "Pioneer DJ",
    model: "DJM-900NXS2",
    name: "Pioneer DJ DJM-900NXS2",
    category: "dj-mixer",
    priceLabel: "$125+GST",
    priceDailyCents: 12500,
    image: "/hire/djm-900nxs2.png",
    imageAspect: "portrait",
    shortDesc: "4-channel club workhorse, the generation before the A9.",
    bullets: [
      "64-bit mixing engine",
      "Sound Color FX + 14 Beat FX",
      "MAGVEL fader, rekordbox dvs ready",
      "2x USB-B for laptop switching",
    ],
    order: 2,
  },
  // ---- All-in-one ----
  {
    slug: "pioneer-dj-xdj-rx2",
    brand: "Pioneer DJ",
    model: "XDJ-RX2",
    name: "Pioneer DJ XDJ-RX2",
    category: "dj-all-in-one",
    priceLabel: "$160+GST",
    priceDailyCents: 16000,
    image: "/hire/xdj-rx2.png",
    imageAspect: "landscape",
    shortDesc:
      "All-in-one 2-deck + 4-channel mixer combo. No laptop or extra players needed.",
    bullets: [
      "7-inch full-colour touchscreen",
      "2 decks + 4-channel mixer in one unit",
      "rekordbox export ready",
      "Compact, perfect for tight setups",
    ],
    order: 1,
  },
  // ---- Speakers ----
  {
    slug: "qsc-k12-2",
    brand: "QSC",
    model: "K12.2",
    name: "QSC K12.2",
    category: "speaker",
    priceLabel: "$75+GST",
    priceDailyCents: 7500,
    image: "/hire/qsc-k12-2.png",
    imageAspect: "portrait",
    shortDesc: "Active 12-inch PA top. Punches well above its weight.",
    bullets: [
      "2000W class-D, 132 dB peak SPL",
      "DMT-driven horn, intrinsic correction DSP",
      "Pole-mount or floor wedge",
      "Hire includes a tripod stand",
    ],
    includedNote: "Includes stand",
    order: 1,
  },
  {
    slug: "ld-systems-icoa-12-a-bt",
    brand: "LD Systems",
    model: "ICOA 12 A BT",
    name: "LD Systems ICOA 12 A BT",
    category: "speaker",
    priceLabel: "$70+GST",
    priceDailyCents: 7000,
    image: "/hire/ld-icoa-12.png",
    imageAspect: "portrait",
    shortDesc:
      "Active 12-inch coaxial PA with built-in Bluetooth. For events without a mixer.",
    bullets: [
      "1200W active coaxial design",
      "Bluetooth audio in",
      "4-channel mixer on the back",
      "Lighter and easier to carry than the K12.2",
    ],
    order: 2,
  },
  // ---- Subs ----
  {
    slug: "qsc-ks118",
    brand: "QSC",
    model: "KS118",
    name: "QSC KS118",
    category: "subwoofer",
    priceLabel: "$110+GST",
    priceDailyCents: 11000,
    image: "/hire/qsc-ks118.png",
    imageAspect: "landscape",
    shortDesc:
      "Active 18-inch subwoofer. Pair with K12.2 tops for a club-ready rig.",
    bullets: [
      "3600W class-D, extends to 41 Hz",
      "Cardioid mode in stereo pairs",
      "Built-in DSP and DMT processing",
      "M20 pole socket for top mounting",
    ],
    order: 1,
  },
];

export const productsByCategory = (cat: ProductCategory): Product[] =>
  PRODUCTS.filter((p) => p.category === cat).sort(
    (a, b) => a.order - b.order,
  );

export const allProducts = (): Product[] =>
  [...PRODUCTS].sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.order - b.order,
  );

export const productBySlug = (slug: string): Product | undefined =>
  PRODUCTS.find((p) => p.slug === slug);

/** Display order for /hire/cdj-hire-christchurch DJ section: CDJ-3000, DJM-A9, XDJ-RX2, CDJ-2000NXS2, DJM-900NXS2. */
export const CDJ_PAGE_DJ_ORDER: string[] = [
  "pioneer-dj-cdj-3000",
  "pioneer-dj-djm-a9",
  "pioneer-dj-xdj-rx2",
  "pioneer-dj-cdj-2000nxs2",
  "pioneer-dj-djm-900nxs2",
];
