import { productService } from "./services/productService"
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import logo from './assets/paradise-shop-logo.svg'

const TABS = [
  { key: 'liquids', label: 'Жижа' },
  { key: 'consumables', label: 'Расходники' },
  { key: 'reviews', label: 'Отзывы' },
]

function Preloader({ visible }) {
  return (
    <div className={`preloader ${visible ? 'active' : ''}`} aria-hidden={!visible}>
      <div className="preloader-inner">
        <div className="preloader-logo-wrap">
          <img className="preloader-logo" src={logo} alt="PARADISE-SHOP" />
          <div className="preloader-smoke" />
        </div>
        <div className="preloader-title">PARADISE-SHOP</div>
        <div className="preloader-subtitle">Загружаем каталог…</div>
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="header">
      <div className="container header-inner">
        <div className="brand">
          <img className="brand-logo" src={logo} alt="PARADISE-SHOP" />
          <div className="brand-text">
            <div className="brand-title">PARADISE-SHOP</div>
            <div className="brand-subtitle">Mini App</div>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="cart-chip" onClick={() => {}}>
            Корзина
          </button>
        </div>
      </div>
    </div>
  )
}

function HeaderWithCart({ cartCount, onOpenCart }) {
  return (
    <div className="header">
      <div className="container header-inner">
        <div className="brand">
          <img className="brand-logo" src={logo} alt="PARADISE-SHOP" />
          <div className="brand-text">
            <div className="brand-title">PARADISE-SHOP</div>
            <div className="brand-subtitle">Mini App</div>
          </div>
        </div>

        <button type="button" className="cart-chip" onClick={onOpenCart}>
          <span className="cart-chip-label">Корзина</span>
          {cartCount > 0 && <span className="cart-chip-badge">{cartCount}</span>}
        </button>
      </div>
    </div>
  )
}

function SearchBar({ value, onChange, onClear, placeholder }) {
  return (
    <div className="search-wrap">
      <div className="container">
        <div className="search">
          <input
            className="search-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
          {value ? (
            <button type="button" className="search-clear" onClick={onClear} aria-label="Очистить">
              ×
            </button>
          ) : (
            <div className="search-icon" aria-hidden>
              ⌕
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TabBar({ activeTab, onChange }) {
  return (
    <div className="tabbar">
      <div className="container tabbar-inner">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tabbar-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ProductGrid({ title, products, onOpenProduct, query }) {
  const normalizedQuery = String(query || '').trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!normalizedQuery) return products
    return products.filter((p) => {
      const nameHit = String(p.name || '').toLowerCase().includes(normalizedQuery)
      const flavorHit = Array.isArray(p.flavors)
        ? p.flavors.some((f) => String(f).toLowerCase().includes(normalizedQuery))
        : false
      return nameHit || flavorHit
    })
  }, [products, normalizedQuery])

  return (
    <div className="screen">
      <div className="container">
        <div className="screen-title">{title}</div>
        {normalizedQuery && (
          <div className="search-hint">
            Найдено: <strong>{filtered.length}</strong>
          </div>
        )}
        <div className="grid">
          {filtered.map((it) => (
            <button
              key={it.id}
              type="button"
              className="card card-clickable"
              onClick={() => onOpenProduct(it)}
            >
              <div className="card-thumb" />
              <div className="card-name">{it.name}</div>
              <div className="card-row">
                <div className="card-price">{it.price} BYN</div>
                <div className="card-open">Открыть</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProductModal({ product, onClose, onAdd }) {
  const isLiquid = product?.category === 'liquids'
  const flavors = product?.flavors || []
  const [selectedFlavor, setSelectedFlavor] = useState(isLiquid ? flavors[0] || '' : '')
  const [qty, setQty] = useState(1)

  useEffect(() => {
    if (!product) return
    const nextIsLiquid = product.category === 'liquids'
    const nextFlavors = product.flavors || []
    setSelectedFlavor(nextIsLiquid ? nextFlavors[0] || '' : '')
    setQty(1)
  }, [product])

  if (!product) return null

  const canAdd = !isLiquid || Boolean(selectedFlavor)

  return (
    <div className={`modal-overlay ${product ? 'active' : ''}`} role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{product.name}</div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-thumb" />
          <div className="modal-row">
            <div className="modal-price">{product.price} BYN</div>
            <div className="muted">В наличии</div>
          </div>

          {isLiquid && (
            <div className="section">
              <div className="section-title">Выбери вкус</div>
              <div className="chips">
                {flavors.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`chip ${selectedFlavor === f ? 'active' : ''}`}
                    onClick={() => setSelectedFlavor(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="section">
            <div className="section-title">Количество</div>
            <div className="qty">
              <button type="button" className="qty-btn" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                −
              </button>
              <div className="qty-value">{qty}</div>
              <button type="button" className="qty-btn" onClick={() => setQty((q) => q + 1)}>
                +
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="modal-btn secondary"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className="modal-btn primary"
            disabled={!canAdd}
            onClick={() => {
              onAdd(product, selectedFlavor || null, qty)
              onClose()
            }}
          >
            В корзину
          </button>
        </div>
      </div>
    </div>
  )
}

function CartDrawer({ open, items, onClose, onDec, onInc, onRemove, onClear }) {
  const total = useMemo(
    () => items.reduce((sum, it) => sum + it.price * it.qty, 0),
    [items]
  )

  return (
    <div className={`cart-drawer-overlay ${open ? 'active' : ''}`} aria-hidden={!open}>
      <div className="cart-drawer" role="dialog" aria-modal="true">
        <div className="cart-drawer-header">
          <div className="cart-drawer-title">Корзина</div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="cart-items">
          {items.length === 0 ? (
            <div className="cart-empty">
              <div className="cart-empty-title">Пусто</div>
              <div className="cart-empty-text">Добавь товары — и оформим заказ.</div>
            </div>
          ) : (
            <div className="cart-items">
              {items.map((it) => (
                <div key={it.key} className="cart-item">
                  <div className="cart-item-thumb" />
                  <div className="cart-item-details">
                    <div className="cart-item-name">{it.name}</div>
                    {it.flavor && <div className="cart-item-flavor">Вкус: {it.flavor}</div>}
                    <div className="cart-item-price">{it.price} BYN</div>
                  </div>
                  <div className="cart-item-qty">
                    <button type="button" className="cart-item-qty-btn" onClick={() => onDec(it)}>
                      −
                    </button>
                    <div className="cart-item-qty-value">{it.qty}</div>
                    <button type="button" className="cart-item-qty-btn" onClick={() => onInc(it)}>
                      +
                    </button>
                    <button type="button" className="cart-item-remove" onClick={() => onRemove(it)}>
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cart-drawer-footer">
          <div className="cart-total">
            <div>Итого</div>
            <div className="cart-total-value">{total.toFixed(2)} BYN</div>
          </div>
          <button
            type="button"
            className="checkout-btn"
            disabled={items.length === 0}
            onClick={() => alert('Дальше сделаем оформление + списание остатков через API')}
          >
            Оформить
          </button>
        </div>
      </div>
    </div>
  )
}

function ReviewsPlaceholder() {
  return (
    <div className="screen">
      <div className="container">
        <div className="screen-title">Отзывы</div>
        <div className="panel">
          <div className="panel-title">Оставь отзыв</div>
          <input className="input" placeholder="Твой ник в Telegram" />
          <textarea className="textarea" placeholder="Напиши отзыв…" rows={4} />
          <button type="button" className="primary-btn">
            Отправить
          </button>
        </div>
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title">Последние отзывы</div>
          <div className="review">
            <div className="review-title">@username</div>
            <div className="review-text">Тут будут реальные отзывы из MySQL.</div>
          </div>
          <div className="review">
            <div className="review-title">@username2</div>
            <div className="review-text">Сделаем красиво, быстро и удобно.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('liquids')
  const [loading, setLoading] = useState(true)
  const [activeProduct, setActiveProduct] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartItems, setCartItems] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)

  // Загрузка товаров с API
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const productsData = await productService.getProducts()
        setProducts(productsData)
      } catch (error) {
        console.error('Error loading products:', error)
      } finally {
        setProductsLoading(false)
      }
    }
    loadProducts()
  }, [])

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return
    try {
      webApp.ready()
      webApp.expand()
      
      // Сохраняем пользователя в базе данных
      const userData = {
        telegram_id: webApp.initDataUnsafe?.user?.id?.toString() || "demo_user",
        username: webApp.initDataUnsafe?.user?.username || "",
        first_name: webApp.initDataUnsafe?.user?.first_name || "",
        last_name: webApp.initDataUnsafe?.user?.last_name || ""
      }
      
      ApiService.saveTelegramUser(userData).then(user => {
        console.log("User saved:", user)
      }).catch(err => {
        console.error("Error saving user:", err)
      })
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return
    try {
      webApp.ready()
      webApp.expand()
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200)
    return () => clearTimeout(timer)
  }, [])

  const cartCount = useMemo(() => cartItems.reduce((sum, it) => sum + it.qty, 0), [cartItems])

  const addToCart = (product, flavor, qty) => {
    const key = `${product.id}::${flavor || 'no-flavor'}`
    setCartItems((prev) => {
      const existing = prev.find((x) => x.key === key)
      if (!existing) {
        return [
          ...prev,
          {
            key,
            id: product.id,
            name: product.name,
            price: product.price,
            flavor: flavor || null,
            qty,
          },
        ]
      }
      return prev.map((x) => (x.key === key ? { ...x, qty: x.qty + qty } : x))
    })
    setCartOpen(true)
  }

  const decItem = (item) => {
    setCartItems((prev) =>
      prev
        .map((x) => (x.key === item.key ? { ...x, qty: Math.max(0, x.qty - 1) } : x))
        .filter((x) => x.qty > 0)
    )
  }

  const incItem = (item) => {
    setCartItems((prev) => prev.map((x) => (x.key === item.key ? { ...x, qty: x.qty + 1 } : x)))
  }

  const removeItem = (item) => {
    setCartItems((prev) => prev.filter((x) => x.key !== item.key))
  }

  useEffect(() => {
    setSearchQuery('')
  }, [activeTab])

  return (
    <div className="app-shell">
      <Preloader visible={loading} />
      <HeaderWithCart cartCount={cartCount} onOpenCart={() => setCartOpen(true)} />

      {activeTab !== 'reviews' && (
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery('')}
          placeholder="Поиск по названию или вкусу…"
        />
      )}

      {activeTab === 'liquids' && (
        <ProductGrid
          title="Жидкости"
          products={products.filter(p => p.category === 'liquids')}
          onOpenProduct={(p) => setActiveProduct(p)}
          query={searchQuery}
        />
      )}
      {activeTab === 'consumables' && (
        <ProductGrid
          title="Расходники"
          products={products.filter(p => p.category === 'consumables')}
          onOpenProduct={(p) => setActiveProduct(p)}
          query={searchQuery}
        />
      )}
      {activeTab === 'reviews' && <ReviewsPlaceholder />}
      <TabBar activeTab={activeTab} onChange={setActiveTab} />
      <ProductModal product={activeProduct} onClose={() => setActiveProduct(null)} onAdd={addToCart} />
      <CartDrawer
        open={cartOpen}
        items={cartItems}
        onClose={() => setCartOpen(false)}
        onDec={decItem}
        onInc={incItem}
        onRemove={removeItem}
        onClear={() => setCartItems([])}
      />
    </div>
  )
}

export default App
