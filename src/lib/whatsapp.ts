import type { Order } from '@/api/orders'
import { formatPrice } from '@/lib/commerce'
import { PAYMENT_LABELS } from '@/lib/orderLabels'

// The wa.me link that opens a chat with the store's WhatsApp, with the order already written out. `number` is digits with
// the country code, as the Api keeps it. The order's access token is never put in the message: it is a link to the
// order, and the chat is not private from whoever the shopper forwards it to.
export function orderWhatsappUrl(number: string, order: Order): string {
  const lines = order.lines.map((l) => `• ${l.quantity} × ${l.name} · ${l.size}`)
  const delivery = order.shippingAddress
    ? `Envío a ${order.shippingAddress.street}${order.deliveryZone ? ` (${order.deliveryZone})` : ''}`
    : 'Retiro en el local'
  const message = [
    `Hola, hice el pedido ${order.number}:`,
    ...lines,
    `Total: ${formatPrice(order.total)} · ${PAYMENT_LABELS[order.paymentMethod]}`,
    delivery,
    `${order.customerName}${order.phone ? ` · ${order.phone}` : ''}`,
  ].join('\n')
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
