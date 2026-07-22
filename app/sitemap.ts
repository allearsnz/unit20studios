import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { HIRE_SERVICES } from "@/lib/hire";

export const revalidate = 86400; // daily

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url;
  const now = new Date();

  const staticPaths: { path: string; priority: number; freq: "weekly" | "monthly" }[] = [
    { path: "", priority: 1, freq: "weekly" },
    { path: "/studio/pricing", priority: 0.8, freq: "monthly" },
    { path: "/studio/the-room", priority: 0.6, freq: "monthly" },
    { path: "/studio/info", priority: 0.6, freq: "monthly" },
    { path: "/studio/book", priority: 0.8, freq: "weekly" },
    { path: "/hire", priority: 0.8, freq: "weekly" },
    { path: "/about", priority: 0.5, freq: "monthly" },
    { path: "/contact", priority: 0.5, freq: "monthly" },
    { path: "/terms", priority: 0.2, freq: "monthly" },
    { path: "/privacy", priority: 0.2, freq: "monthly" },
  ];

  return [
    ...staticPaths.map((p) => ({
      url: `${base}${p.path}`,
      lastModified: now,
      changeFrequency: p.freq,
      priority: p.priority,
    })),
    ...HIRE_SERVICES.map((s) => ({
      url: `${base}/hire/${s.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
