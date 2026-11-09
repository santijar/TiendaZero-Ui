// The store's home carousel (GET /api/promos, Promos/PromoSlides.cs in the Api). Only slides that have a photo are listed,
// in the order the store chose. `category` / `collection` are slugs of the store's own catalog; both null = the whole store.
import { request } from './http'

export interface Promo {
  id: string
  imageUrl: string
  alt: string
  kicker: string
  title: string
  cta: string
  category: string | null
  collection: string | null
}

export function getPromos(): Promise<Promo[]> {
  return request('GET', '/api/promos')
}
