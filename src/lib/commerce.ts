// Platform-wide commerce rules (docs/plan.md §5): global constants for v1, not per-tenant settings.
export const SHIPPING_COST = 0
export const INSTALLMENT_COUNT = 3
export const TRANSFER_DISCOUNT_RATE = 0.1

export function formatPrice(amount: number): string {
  return '$ ' + Math.round(amount).toLocaleString('es-AR')
}

export function installmentsLabel(total: number): string {
  return `${INSTALLMENT_COUNT} cuotas sin interés de ${formatPrice(total / INSTALLMENT_COUNT)}`
}

export function productCountLabel(count: number): string {
  return count + (count === 1 ? ' producto' : ' productos')
}
