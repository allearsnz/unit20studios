import Image from "next/image";
import { Mail, Phone } from "lucide-react";
import type { Product } from "@/lib/products";
import {
  HIRE_PHONE_DISPLAY,
  HIRE_PHONE_TEL,
  buildHireMailto,
} from "@/lib/hire-contact";

type Props = { product: Product; priority?: boolean };

export function ProductCard({ product, priority }: Props) {
  const mailto = buildHireMailto({ product: product.name });
  return (
    <article className="card group flex flex-col">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04),transparent_70%)]">
        <Image
          src={product.image}
          alt={`${product.name} product photo`}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-contain p-6 transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-4 border-t border-border p-6">
        <header className="flex flex-col gap-2">
          <span className="font-mono text-meta uppercase tracking-meta text-text-muted">
            {product.brand}
          </span>
          <h3 className="font-display text-h3 font-semibold text-text">
            {product.model}
          </h3>
          <p className="text-sm text-text-muted">{product.shortDesc}</p>
        </header>
        <ul className="space-y-1.5 text-sm text-text-muted">
          {product.bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="mt-2 inline-block size-1 rounded-full bg-accent" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <footer className="mt-auto flex flex-col gap-3 pt-4">
          <div className="flex items-baseline justify-between border-t border-border pt-4">
            <span className="font-mono text-meta uppercase tracking-meta text-text-dim">
              Per day
            </span>
            <span className="mono text-lg text-text">{product.priceLabel}</span>
          </div>
          {product.includedNote ? (
            <p className="font-mono text-meta uppercase tracking-meta text-accent">
              {product.includedNote}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={mailto}
              className="btn btn-primary inline-flex flex-1 items-center justify-center gap-2 text-sm"
            >
              <Mail className="size-4" aria-hidden /> Email to book
            </a>
            <a
              href={`tel:${HIRE_PHONE_TEL}`}
              className="btn btn-secondary inline-flex flex-1 items-center justify-center gap-2 text-sm"
              aria-label={`Call ${HIRE_PHONE_DISPLAY}`}
            >
              <Phone className="size-4" aria-hidden /> {HIRE_PHONE_DISPLAY}
            </a>
          </div>
        </footer>
      </div>
    </article>
  );
}
