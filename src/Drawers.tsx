import { Check, ClipboardList, Copy, ExternalLink, FileText, Minus, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { displaySku, formatPrice, getEstimate, getLinePrice, isThreePairOffer, MAX_QUANTITY, productImage } from './catalog'
import type { EvidenceRef, Product, ResearchEvidence, SavedItem, Variant } from './catalog'
import './drawers.css'

interface DrawerProps {
  title: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}

function Drawer({ title, children, footer, onClose }: DrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const dismiss = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    const opener = document.activeElement
    element.showModal()
    dismiss.current?.focus()

    return () => {
      element.close()
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      className="drawer"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="drawer-panel">
        <header className="drawer-header">
          <h2 id={titleId}>{title}</h2>
          <button className="drawer-icon-button" ref={dismiss} type="button" onClick={onClose} aria-label="關閉">
            <X size={21} aria-hidden="true" />
          </button>
        </header>
        <div className="drawer-content">{children}</div>
        {footer && <footer className="drawer-footer">{footer}</footer>}
      </div>
    </dialog>
  )
}

function SourcePage({ page }: { page: number }) {
  return <span className="drawer-source"><FileText size={14} aria-hidden="true" />型錄第 {page} 頁</span>
}

function promotionText(product: Product) {
  const amount = product.promoPrice === null ? '' : formatPrice(product.promoPrice)
  return [product.promoNote, amount].filter(Boolean).join(' · ')
}

function CitationEntry({ kind, active, children }: { kind: 'research' | 'catalog'; active: boolean; children: ReactNode }) {
  const element = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (active) element.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <li ref={element} className="drawer-reference" data-reference={kind} data-active={active}
      aria-current={active ? 'true' : undefined}>
      {children}
    </li>
  )
}

function Reference({ entry, index, active }: { entry: EvidenceRef; index: number; active: boolean }) {
  return (
    <CitationEntry kind="catalog" active={active}>
      <h4><span className="drawer-reference-number">[{index + 1}]</span> {entry.title}</h4>
      <p>{entry.detail}</p>
      <SourcePage page={entry.sourcePage} />
    </CitationEntry>
  )
}

const studyTypeLabels: Record<string, string> = {
  'Systematic Review': '系統性回顧',
  'Systematic Review and Meta-Analysis': '系統性回顧與統合分析',
  'Meta-Analysis': '統合分析',
  'Clinical Guideline': '臨床指引',
  'Clinical Practice Guideline': '臨床指引',
  'Randomized Controlled Trial': 'RCT',
  'Randomized Crossover Trial': '隨機交叉試驗',
  'Crossover Study': '交叉研究',
  'Observational Study': '觀察研究',
}

function ResearchReference({ entry, active }: { entry: ResearchEvidence; active: boolean }) {
  return (
    <CitationEntry kind="research" active={active}>
      <div className="drawer-research-heading">
        <h4><span className="drawer-reference-number">[{entry.refId}]</span> {entry.claimTag}</h4>
        <span className="drawer-study-type">{studyTypeLabels[entry.studyType] ?? entry.studyType}</span>
      </div>
      <p>{entry.finding}</p>
      <a className="drawer-research-link" href={entry.url} target="_blank" rel="noopener noreferrer">
        {entry.citation}
        <ExternalLink size={14} aria-hidden="true" />
        <span className="sr-only">（另開分頁）</span>
      </a>
    </CitationEntry>
  )
}

interface EvidenceDrawerProps {
  product: Product
  variant: Variant
  activeRef?: string
  activeResearchRef?: number
  onSelectVariant: (variant: Variant) => void
  onClose: () => void
}

export function EvidenceDrawer({ product, variant, activeRef, activeResearchRef, onSelectVariant, onClose }: EvidenceDrawerProps) {
  const promotion = promotionText(product)

  return (
    <Drawer title="研究證據與型錄規格" onClose={onClose}
      footer={<p className="drawer-clinical-disclaimer">僅供衛教與輔具選配參考，實際使用請諮詢醫師或物理治療師</p>}>
      <div className="drawer-product">
        <img src={productImage(product)} alt="" />
        <div>
          <p className="drawer-secondary">{product.brand} · {product.category}</p>
          <h3>{product.name}</h3>
          <SourcePage page={product.sourcePage} />
        </div>
      </div>

      <section className="drawer-section" aria-labelledby="drawer-research-title">
        <h3 id="drawer-research-title">研究證據</h3>
        <p className="drawer-secondary drawer-research-intro">{product.clinicalIntro}</p>
        <ol className="drawer-references">
          {product.researchEvidence.map(entry => (
            <ResearchReference key={entry.refId} entry={entry} active={entry.refId === activeResearchRef} />
          ))}
        </ol>
      </section>

      <section className="drawer-section">
        <h3>型錄機制與規格</h3>
        <ol className="drawer-references">
          {product.evidenceRefs.map((entry, index) => (
            <Reference key={entry.refId} entry={entry} index={index} active={entry.refId === activeRef} />
          ))}
        </ol>
      </section>

      <section className="drawer-section">
        <h3>尺寸與品號</h3>
        <p className="drawer-secondary">
          {product.sizing || '型錄未提供對照量測方式，請向診所確認尺寸。'}
        </p>
        <table className="drawer-variant-table">
          <thead>
            <tr><th scope="col">尺寸／款式</th><th scope="col">品號</th><th scope="col">型錄供貨</th></tr>
          </thead>
          <tbody>
            {product.variants.map((option) => {
              const selected = option.sku === variant.sku
              return (
                <tr key={option.sku} data-selected={selected}>
                  <th scope="row">
                    <button type="button" className="drawer-variant-button" aria-pressed={selected} onClick={() => onSelectVariant(option)}>
                      {selected && <Check size={14} aria-hidden="true" />}
                      {option.sizeOrColor}
                    </button>
                  </th>
                  <td>{displaySku(option)}</td>
                  <td>{option.stockStatus}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="drawer-section">
        <h3>型錄所列價格</h3>
        <p>{formatPrice(product.price)}</p>
        {promotion && <p className="drawer-promotion">{promotion}</p>}
      </section>
    </Drawer>
  )
}

interface ConsultationDrawerProps {
  items: SavedItem[]
  onRemove: (product: Product, variant: Variant) => void
  onQuantityChange: (product: Product, variant: Variant, quantity: number) => void
  onClose: () => void
}

function pricingNotes(items: SavedItem[]) {
  const notes: string[] = []
  if (items.some(({ product }) => isThreePairOffer(product))) {
    notes.push('三雙特價按同一品號每滿三雙計算，餘數按原價。')
  }
  if (items.some(({ product }) => product.promoNote.includes('買二送一'))) {
    notes.push('買二送一待診所確認，未折抵估算金額。')
  }
  if (items.some(({ product }) => product.promoNote.includes('優惠碼') && product.promoPrice !== null)) {
    notes.push('已按型錄所列優惠碼價格估算，適用條件請向診所確認。')
  }
  return notes
}

function estimateLabel(estimate: ReturnType<typeof getEstimate>) {
  return estimate.unpricedLines > 0 ? '已知價格合計' : '估算總金額'
}

function estimateValue(estimate: ReturnType<typeof getEstimate>, count: number) {
  return formatPrice(count === estimate.unpricedLines ? null : estimate.amount)
}

function consultationText(items: SavedItem[], estimate: ReturnType<typeof getEstimate>, notes: string[]) {
  const lines = items.map(({ product, variant, quantity }, index) => {
    const base = `${index + 1}. ${product.name}｜${variant.sizeOrColor}｜品號 ${displaySku(variant)}｜數量 ${quantity}｜型錄供貨 ${variant.stockStatus}｜估算小計 ${formatPrice(getLinePrice(product, quantity))}`
    const offer = promotionText(product)
    return offer ? `${base}｜${offer}` : base
  })
  return [
    '梅科輔具諮詢清單',
    ...lines,
    `${estimateLabel(estimate)} ${estimateValue(estimate, items.length)}`,
    ...notes,
    '請協助確認適合尺寸、實際庫存及優惠條件。',
  ].join('\n')
}

function QuantityControl({ name, quantity, onChange }: { name: string; quantity: number; onChange: (value: number) => void }) {
  return (
    <div className="drawer-quantity" role="group" aria-label={`${name} 數量`}>
      <button type="button" aria-label={`減少 ${name} 數量`} aria-disabled={quantity <= 1}
        onClick={() => { if (quantity > 1) onChange(quantity - 1) }}>
        <Minus size={16} aria-hidden="true" />
      </button>
      <output aria-label="目前數量">{quantity}</output>
      <button type="button" aria-label={`增加 ${name} 數量`} aria-disabled={quantity >= MAX_QUANTITY}
        onClick={() => { if (quantity < MAX_QUANTITY) onChange(quantity + 1) }}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

export function ConsultationDrawer({ items, onRemove, onQuantityChange, onClose }: ConsultationDrawerProps) {
  const [copyResult, setCopyResult] = useState<{ text: string; state: 'copied' | 'manual' }>()
  const [showCopyToast, setShowCopyToast] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const copyTarget = useRef<HTMLTextAreaElement>(null)
  const copyButton = useRef<HTMLButtonElement>(null)
  const emptyButton = useRef<HTMLButtonElement>(null)
  const removeButtons = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocus = useRef<number | null>(null)
  const estimate = getEstimate(items)
  const notes = pricingNotes(items)
  const summary = consultationText(items, estimate, notes)
  const copyState = copyResult?.text === summary ? copyResult.state : 'idle'
  const itemKey = ({ product, variant }: SavedItem) => JSON.stringify([product.id, variant.sku])

  useEffect(() => {
    if (copyState !== 'manual') return
    copyTarget.current?.focus()
    copyTarget.current?.select()
  }, [copyState])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  useLayoutEffect(() => {
    if (pendingFocus.current === null) return
    const next = items[Math.min(pendingFocus.current, items.length - 1)]
    pendingFocus.current = null
    if (next) {
      const nextButton = removeButtons.current.get(itemKey(next)) ?? copyButton.current
      nextButton?.focus()
    } else {
      emptyButton.current?.focus()
    }
  }, [items])

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary)
    } catch {
      setCopyResult({ text: summary, state: 'manual' })
      copyTarget.current?.focus()
      copyTarget.current?.select()
      return
    }
    setCopyResult({ text: summary, state: 'copied' })
    setShowCopyToast(true)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setShowCopyToast(false), 3500)
  }

  return (
    <Drawer
      title="我的評估清單"
      onClose={onClose}
      footer={items.length > 0 && (
        <>
          <div className="drawer-estimate" aria-live="polite">
            <span>{estimateLabel(estimate)} · {estimate.unitCount} 件</span>
            <strong>{estimateValue(estimate, items.length)}</strong>
          </div>
          <button className="drawer-primary-button" type="button" ref={copyButton} onClick={copySummary}>
            <Copy size={17} aria-hidden="true" />
            複製諮詢摘要
          </button>
        </>
      )}
    >
      <div className="drawer-copy-toast-region" role="status">
        {showCopyToast && copyState === 'copied' && (
          <span className="drawer-copy-toast"><Check size={17} aria-hidden="true" />已複製清單，可直接貼上 LINE 諮詢</span>
        )}
      </div>
      {items.length === 0 ? (
        <div className="drawer-empty">
          <ClipboardList size={30} strokeWidth={1.5} aria-hidden="true" />
          <h3>清單目前是空的</h3>
          <p>在型錄選好尺寸或款式後，可將商品加入清單。</p>
          <button className="drawer-secondary-button" type="button" ref={emptyButton} onClick={onClose}>返回型錄</button>
        </div>
      ) : (
        <>
          <ul className="drawer-saved-list">
            {items.map((item, index) => {
              const { product, variant, quantity } = item
              const key = itemKey(item)
              const promotion = promotionText(product)
              return (
                <li key={key} className="drawer-saved-row">
                  <img src={productImage(product)} alt="" />
                  <div className="drawer-saved-info">
                    <h3>{product.name}</h3>
                    <p>{variant.sizeOrColor} · {displaySku(variant)}</p>
                    <p>{formatPrice(product.price)} · 型錄供貨 {variant.stockStatus}</p>
                    {promotion && <p className="drawer-promotion">{promotion}</p>}
                  </div>
                  <button
                    type="button"
                    className="drawer-icon-button"
                    aria-label={`移除 ${product.name} ${variant.sizeOrColor}`}
                    ref={(element) => {
                      if (element) removeButtons.current.set(key, element)
                      else removeButtons.current.delete(key)
                    }}
                    onClick={() => {
                      pendingFocus.current = index
                      setCopyResult(undefined)
                      onRemove(product, variant)
                    }}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                  <div className="drawer-saved-actions">
                    <QuantityControl
                      name={`${product.name} ${variant.sizeOrColor}`}
                      quantity={quantity}
                      onChange={(value) => {
                        setCopyResult(undefined)
                        onQuantityChange(product, variant, value)
                      }}
                    />
                    <span className="drawer-line-price">
                      <span>估算小計</span>
                      <strong>{formatPrice(getLinePrice(product, quantity))}</strong>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="drawer-pricing-note">
            {estimate.unpricedLines > 0 && <p>{estimate.unpricedLines} 筆價格待核對。</p>}
            {notes.map((note) => <p key={note}>{note}</p>)}
            <p>價格、庫存及優惠以診所回覆為準。</p>
          </div>
          {copyState === 'manual' && (
            <label className="drawer-copy-area">
              諮詢摘要
              <span className="drawer-secondary" role="status">請手動複製已選取的摘要。</span>
              <textarea ref={copyTarget} value={summary} readOnly rows={8} />
            </label>
          )}
        </>
      )}
    </Drawer>
  )
}
