import type { Order, OrderStatus, PaymentMethod } from '@/api/orders'

// How order states read to people, shared by the shopper's pages and the admin.
export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente de pago',
  paid: 'Pagado',
  expired: 'Vencido',
}

export const FULFILLMENT_LABELS: Record<Order['fulfillment'], string> = {
  unfulfilled: 'Sin preparar',
  preparing: 'Preparando',
  shipped: 'Enviado',
  'ready-for-pickup': 'Listo para retirar',
  delivered: 'Entregado',
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  mercadopago: 'Mercado Pago',
  transfer: 'Transferencia',
  cash: 'Efectivo',
}

export function formatDate(iso: string, withTime = false): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
