import catalog from './data/products.json'

export type Variant = {
  sku: string
  sizeOrColor: string
  stockStatus: string
}

export type EvidenceRef = {
  refId: string
  title: string
  detail: string
  sourcePage: number
}

export type ResearchEvidence = {
  refId: number
  claimTag: string
  citation: string
  studyType: string
  finding: string
  url: string
}

export type Product = {
  id: string
  category: string
  bodyPart: string
  name: string
  brand: string
  variants: Variant[]
  price: number | null
  promoPrice: number | null
  promoNote: string
  imagePath: string
  sourcePage: number
  sizing?: string
  keyMechanisms: string[]
  evidenceRefs: EvidenceRef[]
  clinicalIntro: string
  researchEvidence: ResearchEvidence[]
}

export type SavedItem = { product: Product; variant: Variant; quantity: number }
export type SavedKey = { productId: string; sku: string; quantity: number }

export const MAX_QUANTITY = 99

export const products: Product[] = catalog
const productsById = new Map(products.map(product => [product.id, product]))
const priceFormat = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 })

export function formatPrice(price: number | null) {
  return price === null ? '價格待核對' : `NT$ ${priceFormat.format(price)}`
}

export function displaySku(variant: Variant) {
  return variant.sku || '待核對'
}

export function productImage(product: Product) {
  return import.meta.env.BASE_URL + product.imagePath.replace(/^\//, '')
}

export function savedProduct(key: SavedKey): SavedItem | null {
  const product = productsById.get(key.productId)
  const variant = product?.variants.find(entry => entry.sku === key.sku)
  return product && variant ? { product, variant, quantity: clampQuantity(key.quantity) } : null
}

export function clampQuantity(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1
  return Math.max(1, Math.min(MAX_QUANTITY, Math.trunc(value)))
}

export function isThreePairOffer(product: Product) {
  return product.promoPrice !== null && product.promoNote.includes('三雙')
}

export function getUnitPrice(product: Product) {
  return isThreePairOffer(product) ? product.price : product.promoPrice ?? product.price
}

export function getLinePrice(product: Product, quantity: number) {
  const count = clampQuantity(quantity)
  const { price, promoPrice } = product
  if (promoPrice === null || !isThreePairOffer(product)) {
    const unit = getUnitPrice(product)
    return unit === null ? null : count * unit
  }

  const remaining = count % 3
  if (remaining && price === null) return null
  const bundles = Math.floor(count / 3)
  return bundles * promoPrice + remaining * (price ?? 0)
}

export function getEstimate(items: SavedItem[]) {
  return items.reduce((estimate, { product, quantity }) => {
    const count = clampQuantity(quantity)
    const line = getLinePrice(product, count)
    return {
      amount: estimate.amount + (line ?? 0),
      unpricedLines: estimate.unpricedLines + Number(line === null),
      unitCount: estimate.unitCount + count,
    }
  }, { amount: 0, unpricedLines: 0, unitCount: 0 })
}

const STORAGE_KEY = 'meike-orthotic-inquiries-v1'

export function loadSavedItems(): SavedKey[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    const keys = new Map<string, SavedKey>()
    for (const entry of parsed) {
      if (!entry || typeof entry.productId !== 'string' || typeof entry.sku !== 'string') continue
      const key = { productId: entry.productId, sku: entry.sku, quantity: clampQuantity(entry.quantity) }
      if (savedProduct(key)) keys.set(`${key.productId}/${key.sku}`, key)
    }
    return [...keys.values()]
  } catch {
    return []
  }
}

export function storeSavedItems(keys: SavedKey[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
    return true
  } catch {
    return false
  }
}

export function normalizeSearch(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('zh-TW').replace(/[–—]/g, '-')
}

export function searchProduct(product: Product, terms: string[]) {
  const text = normalizeSearch([
    product.name, product.category, product.bodyPart, product.brand,
    ...product.keyMechanisms,
    ...product.variants.flatMap(variant => [variant.sku, variant.sizeOrColor]),
  ].join(' '))
  return terms.every(term => text.includes(term))
}
