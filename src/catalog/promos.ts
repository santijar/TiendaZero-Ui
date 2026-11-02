// Home promo carousel, taken from the prototype. Each slide's CTA applies a catalog filter
// (a category or collection slug from the API, or neither for the whole store).
import basquet from '@/assets/campaign/campaign-basquet.jpeg'
import estadio from '@/assets/campaign/campaign-estadio.jpeg'
import futbol from '@/assets/campaign/campaign-futbol.jpeg'
import running from '@/assets/campaign/campaign-running.jpeg'
import training from '@/assets/campaign/campaign-training.jpeg'

export interface CatalogFilter {
  category?: string
  collection?: string
}

export interface PromoSlide {
  image: string
  alt: string
  kicker: string
  title: string
  cta: string
  filter: CatalogFilter
}

export const PROMO_SLIDES: PromoSlide[] = [
  {
    image: futbol,
    alt: 'Fútbol',
    kicker: 'Fútbol',
    title: 'Hecho para la cancha',
    cta: 'Ver camisetas',
    filter: { category: 'camisetas' },
  },
  {
    image: running,
    alt: 'Running',
    kicker: 'Running',
    title: 'Cada kilómetro cuenta',
    cta: 'Ver shorts',
    filter: { category: 'shorts' },
  },
  {
    image: training,
    alt: 'Training',
    kicker: 'Training',
    title: 'Entrená como jugás',
    cta: 'Ver colección',
    filter: { collection: 'entrenamiento' },
  },
  {
    image: basquet,
    alt: 'Básquet',
    kicker: 'Básquet',
    title: 'Dominá la duela',
    cta: 'Ver remeras',
    filter: { category: 'camisetas' },
  },
  {
    image: estadio,
    alt: 'Estadio',
    kicker: 'Temporada 26',
    title: 'Salí a la cancha con Regate',
    cta: 'Toda la tienda',
    filter: {},
  },
]
