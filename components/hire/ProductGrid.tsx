import type { Product } from "@/lib/products";
import { ProductCard } from "./ProductCard";

/**
 * Above-the-fold cards (first row on mobile / first 3 on desktop) should set
 * priority for LCP. Pass `priorityCount` to control how many.
 */
export function ProductGrid({
  products,
  priorityCount = 0,
}: {
  products: Product[];
  priorityCount?: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p, i) => (
        <ProductCard key={p.slug} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}
