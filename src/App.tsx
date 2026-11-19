import {
  ArrowRight, Bookmark, Check, ChevronDown, ClipboardList, Cross, FileText,
  Plus, Search, X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  clampQuantity, displaySku, formatPrice, getUnitPrice, isThreePairOffer, loadSavedItems, normalizeSearch, productImage,
  products, savedProduct, searchProduct, storeSavedItems,
} from './catalog'
import type { Product, SavedItem, SavedKey, Variant } from './catalog'
import { ConsultationDrawer, EvidenceDrawer } from './Drawers'

const filters = [
  { label: '全部', parts: [] },
  { label: '足部／機能襪', parts: ['足部'] },
  { label: '手腕與手肘', parts: ['手腕', '手肘'] },
  { label: '腰部支撐', parts: ['腰部'] },
  { label: '膝蓋與腳踝', parts: ['膝蓋', '腳踝'] },
  { label: '訓練與儀器', parts: ['全身', '眼部', '上臂'] },
  { label: '營養保健', parts: ['營養保健'] },
]

// Discovery terms map to catalogue uses and anatomical regions.
const needTerms: Record<string, string[]> = {
  足部: ['足弓', '足底', '腳底', '足跟', '久站', '走路', '足部支撐', '足底痛', '腳底痛', '足跟痛', '足部疼痛'],
  手腕: ['手部支撐', '拇指', '虎口', '腕部', '手腕痛', '手腕疼痛', '腕部不適', '手腕支撐', '護腕'],
  腰部: ['下背', '腰痠', '腰酸', '腰痛', '腰部痠痛', '腰背不適', '腰部支撐', '護腰'],
  膝蓋: ['膝部', '膝痛', '膝蓋痛', '膝蓋疼痛', '膝關節', '髕骨', '膝部支撐', '護膝'],
  腳踝: ['足踝', '踝關節', '腳踝痛', '腳踝疼痛', '踝部支撐', '扭傷', '護踝'],
  眼部: ['眼睛', '眼周', '眼睛疲勞', '眼部疲勞', '熱敷', '放鬆'],
  上臂: ['量血壓', '血壓監測', '健康量測'],
  營養保健: ['營養補充', '保健品', '保健食品'],
  運動訓練: ['阻力訓練', '肌力訓練', '彈力帶'],
  放鬆儀器: ['肌肉放鬆', '肌肉緊繃', '按摩器'],
}

function matchesSearch(product: Product, terms: string[]) {
  const aliases = [...(needTerms[product.bodyPart] ?? []), ...(needTerms[product.category] ?? [])]
  return terms.every(term => searchProduct(product, [term]) || aliases.some(alias => alias.includes(term)))
}

const leadProducts = ['a040127', 'a040118', 'a040111', 'a040122', 'a040143']
const introOrder = new Map(leadProducts.map((id, index) => [id, index]))
const browseProducts = [...products].sort((a, b) =>
  (introOrder.get(a.id) ?? leadProducts.length) - (introOrder.get(b.id) ?? leadProducts.length),
)

function matchesFilter(product: Product, filter: number) {
  const { parts } = filters[filter]
  return parts.length === 0 || parts.includes(product.bodyPart)
}

function matchSaved(key: SavedKey, product: Product, variant: Variant) {
  return key.productId === product.id && key.sku === variant.sku
}

function promotionBadge(note: string) {
  return note.match(/三雙特價|買二送一|\d+\s*折/)?.[0].replace(/\s/g, '') ?? note
}

type DrawerState = { kind: 'list' } | { kind: 'evidence'; product: Product; researchRef?: number } | null

type CardProps = {
  product: Product
  variant: Variant
  saved: boolean
  priority: boolean
  onVariant: (variant: Variant) => void
  onSave: () => void
  onEvidence: (researchRef?: number) => void
}

function ProductCard({ product, variant, saved, priority, onVariant, onSave, onEvidence }: CardProps) {
  const price = getUnitPrice(product)
  const bundle = isThreePairOffer(product)
  const badge = promotionBadge(product.promoNote)
  const offer = bundle
    ? `三雙合計 ${formatPrice(product.promoPrice)}`
    : product.promoNote.split('｜').find(part => part.startsWith('優惠碼'))
  return (
    <article className="product-card">
      <div className="product-media">
        <img
          src={productImage(product)}
          alt={product.category === '運動訓練' ? `${product.name}原型錄共用圖` : product.name}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="object-contain"
        />
        <button className="media-reference" type="button" onClick={() => onEvidence()}
          aria-label={`型錄第 ${product.sourcePage} 頁，查看 ${product.name} 規格`}>
          <FileText size={15} aria-hidden="true" />
          <span>型錄第 {product.sourcePage} 頁</span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="product-info">
        <div className="product-meta">
          <span className="brand-tag">{product.brand}</span>
          {badge && <span className="promo-badge">{badge}</span>}
          <span className={`stock ${variant.stockStatus === '正常' ? 'stock-normal' : ''}`}>
            <span className="stock-dot" aria-hidden="true" />
            {variant.stockStatus === '正常' ? '型錄供貨正常' : `型錄${variant.stockStatus}`}
          </span>
        </div>
        <h3>{product.name}</h3>
        <div className="product-purchase">
          <div className="price-line">
            <span className={price === null ? 'price-missing' : 'price-current'}>{formatPrice(price)}</span>
            {price !== product.price && <s className="price-original">{formatPrice(product.price)}</s>}
            {bundle && <span className="price-unit">／雙</span>}
          </div>
          {offer && <p className="promo-line">{offer}</p>}
        </div>
        <p className="clinical-intro">
          {product.clinicalIntro}
          {product.researchEvidence.map(ref => (
            <button className="cite" type="button" key={ref.refId}
              aria-label={`[${ref.refId}] ${product.name}，${ref.claimTag}`}
              onClick={() => onEvidence(ref.refId)}
            ><span>[{ref.refId}]</span></button>
          ))}
        </p>
        <div className="variant-section">
          <div className="variant-meta">
            <span>尺寸／規格</span>
            <span aria-live="polite">貨號 <b>{displaySku(variant)}</b></span>
          </div>
          {product.variants.length > 1 ? (
            <div className="variant-pills" role="group" aria-label={`${product.name} 尺寸／規格`}>
              {product.variants.map(option => (
                <button className="variant-pill" type="button" key={option.sku}
                  aria-pressed={variant.sku === option.sku} onClick={() => onVariant(option)}>
                  {option.sizeOrColor}
                </button>
              ))}
            </div>
          ) : <p className="static-variant">{variant.sizeOrColor}</p>}
          <button className={`add-button ${saved ? 'is-saved' : ''}`} type="button"
            aria-label={`${saved ? '已加入清單，按下可移除' : '加入清單'}：${product.name} ${variant.sizeOrColor}`}
            aria-pressed={saved} onClick={onSave}>
            {saved ? <Check size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
            {saved ? '已加入清單' : '加入清單'}
          </button>
        </div>
      </div>
    </article>
  )
}

export function App() {
  const [filter, setFilter] = useState(0)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('browse')
  const [variants, setVariants] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(loadSavedItems)
  const [persistence, setPersistence] = useState(true)
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const search = useRef<HTMLInputElement>(null)
  const terms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean)
  const matches = (sort === 'browse' ? browseProducts : products).filter(product => matchesSearch(product, terms))
  const counts = filters.map((_, index) => matches.filter(product => matchesFilter(product, index)).length)
  const filtered = matches.filter(product => matchesFilter(product, filter))
  if (sort === 'low' || sort === 'high') {
    filtered.sort((a, b) => {
      const first = getUnitPrice(a)
      const second = getUnitPrice(b)
      if (first === null) return second === null ? 0 : 1
      if (second === null) return -1
      return sort === 'low' ? first - second : second - first
    })
  }

  const savedItems = saved.map(savedProduct).filter((item): item is SavedItem => item !== null)
  const savedCount = savedItems.reduce((count, item) => count + item.quantity, 0)
  useEffect(() => { setPersistence(storeSavedItems(saved)) }, [saved])

  function selectedVariant(product: Product) {
    return product.variants.find(option => option.sku === variants[product.id]) ?? product.variants[0]
  }

  function selectVariant(product: Product, variant: Variant) {
    setVariants(current => ({ ...current, [product.id]: variant.sku }))
  }

  function updateSearch(value: string) {
    setQuery(value)
    const sku = normalizeSearch(value).trim()
    if (!/^a\d{6}$/.test(sku)) return
    for (const product of products) {
      const variant = product.variants.find(option => normalizeSearch(option.sku) === sku)
      if (variant) {
        selectVariant(product, variant)
        if (!matchesFilter(product, filter)) setFilter(0)
        break
      }
    }
  }

  function clearSearch() {
    setQuery('')
    search.current?.focus()
  }

  function removeSaved(product: Product, variant: Variant) {
    setSaved(current => current.filter(key => !matchSaved(key, product, variant)))
  }

  function setQuantity(product: Product, variant: Variant, quantity: number) {
    setSaved(current => current.map(key =>
      matchSaved(key, product, variant) ? { ...key, quantity: clampQuantity(quantity) } : key))
  }

  function toggleSaved(product: Product, variant: Variant) {
    setSaved(current => current.some(key => matchSaved(key, product, variant))
      ? current.filter(key => !matchSaved(key, product, variant))
      : [...current, { productId: product.id, sku: variant.sku, quantity: 1 }])
  }

  return (
    <>
      <a className="skip-link" href="#catalog">跳至商品</a>
      <header className="site-header">
        <div className="shell topbar">
          <div className="brand-lockup">
            <span className="brand-mark"><Cross size={23} strokeWidth={2.1} aria-hidden="true" /></span>
            <div>
              <h1>梅科輔具指南</h1>
              <p>依部位與需求，比較輔具規格與價格</p>
            </div>
          </div>
          <div className="search-field" role="search">
            <Search size={19} strokeWidth={1.8} aria-hidden="true" />
            <input ref={search} type="search" aria-label="搜尋品名、部位、需求或貨號"
              placeholder="搜尋品名、部位、需求或貨號" value={query}
              onChange={event => updateSearch(event.target.value)} />
            {query && <button type="button" className="clear-search" aria-label="清除搜尋"
              onClick={clearSearch}><X size={17} aria-hidden="true" /></button>}
          </div>
        </div>
      </header>

      <main className="shell main-shell" id="catalog">
        <nav className="filter-panel" aria-label="按部位或需求篩選">
          <div className="filter-track">
            {filters.map(({ label }, index) => (
              <button className="filter-button" type="button" key={label}
                aria-pressed={filter === index} onClick={() => setFilter(index)}>
                {label}<span className="filter-count">{counts[index]}</span>
              </button>
            ))}
          </div>
        </nav>

        <section className="results" aria-labelledby="results-title">
          <div className="results-top">
            <div className="results-heading">
              <h2 id="results-title">{filter === 0 ? '全部品項' : filters[filter].label}</h2>
              <span className="results-count" role="status">{filtered.length} 項</span>
            </div>
            <div className="sort-wrap">
              <div className="select-wrap">
                <select id="sort-products" aria-label="排序" value={sort} onChange={event => setSort(event.target.value)}>
                  <option value="browse">綜合瀏覽</option>
                  <option value="source">型錄頁次</option>
                  <option value="low">價格由低到高</option>
                  <option value="high">價格由高到低</option>
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </div>
            </div>
          </div>

          {filtered.length ? (
            <div className="product-grid">
              {filtered.map((product, index) => {
                const variant = selectedVariant(product)
                return <ProductCard key={product.id} product={product} variant={variant}
                  saved={saved.some(key => matchSaved(key, product, variant))} priority={index < 3}
                  onVariant={option => selectVariant(product, option)}
                  onSave={() => toggleSaved(product, variant)}
                  onEvidence={researchRef => setDrawer({ kind: 'evidence', product, researchRef })}
                />
              })}
            </div>
          ) : (
            <div className="empty-results">
              <Search size={28} aria-hidden="true" />
              <h3>找不到符合的品項</h3>
              <p>可試試「足弓」、「腰部」或完整貨號。</p>
              <button type="button" className="reset-button" onClick={() => {
                setFilter(0)
                clearSearch()
              }}>清除篩選</button>
            </div>
          )}
        </section>
      </main>

      <footer className="shell site-footer">
        <span><FileText size={15} aria-hidden="true" /> 資料來源《梅科輔具品項》</span>
        <span>適用性、價格、供貨與優惠以診所回覆為準。</span>
      </footer>

      <button className="evaluation-dock" type="button" aria-haspopup="dialog"
        onClick={() => setDrawer({ kind: 'list' })}>
        {savedCount ? <Bookmark size={19} aria-hidden="true" /> : <ClipboardList size={19} aria-hidden="true" />}
        <span className="dock-label">我的評估清單</span>
        <span className="list-count" aria-live="polite">{savedCount}<span className="sr-only"> 件</span></span>
      </button>
      {!persistence && <p className="storage-note" role="status">此瀏覽器無法儲存清單，請在離開前複製諮詢內容。</p>}
      {drawer?.kind === 'evidence' && (
        <EvidenceDrawer product={drawer.product} variant={selectedVariant(drawer.product)}
          activeResearchRef={drawer.researchRef}
          activeRef={drawer.researchRef === undefined ? drawer.product.evidenceRefs[0]?.refId : undefined}
          onSelectVariant={variant => selectVariant(drawer.product, variant)}
          onClose={() => setDrawer(null)} />
      )}
      {drawer?.kind === 'list' && (
        <ConsultationDrawer items={savedItems} onRemove={removeSaved} onQuantityChange={setQuantity}
          onClose={() => setDrawer(null)} />
      )}
    </>
  )
}
