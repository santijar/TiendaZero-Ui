// The small text under a product's name in a cart, checkout or order line: its brand, its size (a clothing store's
// "Talle M"; a grocery sells by the pack and has no size to show), and optionally the quantity.
export function lineLabel(
  line: { brand: string | null; size: string },
  options: { grocery: boolean; quantity?: number },
): string {
  return [
    line.brand,
    options.grocery ? null : `Talle ${line.size}`,
    options.quantity === undefined ? null : `x${options.quantity}`,
  ]
    .filter(Boolean)
    .join(' · ')
}
