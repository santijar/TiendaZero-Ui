// Static catalog fixture taken from the prototype. Replaced by the catalog API later in Milestone 1.
import camTitular from '@/assets/products/cam-titular.webp'
import campera from '@/assets/products/campera.webp'
import basquet from '@/assets/campaign/campaign-basquet.jpeg'
import estadio from '@/assets/campaign/campaign-estadio.jpeg'
import futbol from '@/assets/campaign/campaign-futbol.jpeg'
import running from '@/assets/campaign/campaign-running.jpeg'
import training from '@/assets/campaign/campaign-training.jpeg'

export interface Product {
  id: string
  name: string
  category: string
  price: number
  tag: string | null
  color: string
  sizes: string[]
  description: string
  image: string | null
}

export const ALL_CATEGORY = 'Todo'
// Not a real category: the "Training" promo slide filters by the product tag instead.
export const TRAINING_CATEGORY = 'Entrenamiento'

export const CATEGORIES = [ALL_CATEGORY, 'Camisetas', 'Shorts', 'Abrigo', 'Accesorios']

const SIZES = ['S', 'M', 'L', 'XL', 'XXL']

export const PRODUCTS: Product[] = [
  {
    id: 'cam-titular',
    name: 'Camiseta Titular 26',
    category: 'Camisetas',
    price: 48900,
    tag: 'Nuevo',
    color: 'Negro',
    sizes: SIZES,
    description:
      'Tela dry-fit liviana con paneles de ventilación laterales. Corte regular, cuello redondo y escudo termoadherido.',
    image: camTitular,
  },
  {
    id: 'cam-alt',
    name: 'Camiseta Alternativa',
    category: 'Camisetas',
    price: 45900,
    tag: null,
    color: 'Blanco',
    sizes: SIZES,
    description:
      'Versión suplente en tejido microperforado. Secado rápido y costuras planas para evitar roces.',
    image: null,
  },
  {
    id: 'short-train',
    name: 'Short de Entrenamiento',
    category: 'Shorts',
    price: 28500,
    tag: null,
    color: 'Negro',
    sizes: SIZES,
    description:
      'Short con cintura elástica y cordón, bolsillos laterales con cierre y tela elastizada en cuatro direcciones.',
    image: null,
  },
  {
    id: 'buzo-hz',
    name: 'Buzo Half-Zip',
    category: 'Abrigo',
    price: 72900,
    tag: 'Entrenamiento',
    color: 'Gris topo',
    sizes: SIZES,
    description:
      'Primera capa térmica con medio cierre, puños con orificio para pulgar y logo reflectivo.',
    image: null,
  },
  {
    id: 'campera',
    name: 'Campera Rompeviento',
    category: 'Abrigo',
    price: 89900,
    tag: null,
    color: 'Negro',
    sizes: SIZES,
    description:
      'Repelente al agua, capucha ajustable y bolsillo canguro. Se guarda en su propio bolsillo.',
    image: campera,
  },
  {
    id: 'remera-dry',
    name: 'Remera Dry Training',
    category: 'Camisetas',
    price: 32900,
    tag: 'Entrenamiento',
    color: 'Azul noche',
    sizes: SIZES,
    description:
      'Remera de entrenamiento de secado rápido, corte atlético y detalles en contraste.',
    image: null,
  },
  {
    id: 'medias',
    name: 'Medias Técnicas',
    category: 'Accesorios',
    price: 9900,
    tag: null,
    color: 'Negro',
    sizes: ['S', 'M', 'L'],
    description:
      'Medias con zonas de compresión y puntera reforzada. Talle S (35–38), M (39–42), L (43–46).',
    image: null,
  },
  {
    id: 'bolso',
    name: 'Bolso Deportivo',
    category: 'Accesorios',
    price: 54900,
    tag: null,
    color: 'Negro',
    sizes: ['Único'],
    description: 'Bolso de 40 L con compartimento ventilado para botines y correa acolchada.',
    image: null,
  },
]

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}

export interface PromoSlide {
  image: string
  alt: string
  kicker: string
  title: string
  cta: string
  category: string
}

export const PROMO_SLIDES: PromoSlide[] = [
  {
    image: futbol,
    alt: 'Fútbol',
    kicker: 'Fútbol',
    title: 'Hecho para la cancha',
    cta: 'Ver camisetas',
    category: 'Camisetas',
  },
  {
    image: running,
    alt: 'Running',
    kicker: 'Running',
    title: 'Cada kilómetro cuenta',
    cta: 'Ver shorts',
    category: 'Shorts',
  },
  {
    image: training,
    alt: 'Training',
    kicker: 'Training',
    title: 'Entrená como jugás',
    cta: 'Ver colección',
    category: TRAINING_CATEGORY,
  },
  {
    image: basquet,
    alt: 'Básquet',
    kicker: 'Básquet',
    title: 'Dominá la duela',
    cta: 'Ver remeras',
    category: 'Camisetas',
  },
  {
    image: estadio,
    alt: 'Estadio',
    kicker: 'Temporada 26',
    title: 'Salí a la cancha con Regate',
    cta: 'Toda la tienda',
    category: ALL_CATEGORY,
  },
]
