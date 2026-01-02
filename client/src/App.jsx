import { useEffect, useMemo, useState } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import logo from './assets/paradise-shop-logo.svg'
import ApiService from './services/api'
import AdminLogin from './components/AdminLogin'
import AdminPanel from './components/AdminPanel'

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

function CheckoutModal({ open, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({
    telegram_username: '',
  })

  useEffect(() => {
    if (!open) return
    setForm({ telegram_username: '' })
  }, [open])

  if (!open) return null

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Оформление заказа</div>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="section">
            <div className="section-title">Твой Telegram username</div>
            <input
              className="input"
              placeholder="например: ilanmace (без @)"
              value={form.telegram_username}
              onChange={(e) => setForm((p) => ({ ...p, telegram_username: e.target.value }))}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-btn secondary" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="modal-btn primary"
            disabled={submitting}
            onClick={() => onSubmit(form)}
          >
            {submitting ? 'Отправляем…' : 'Подтвердить'}
          </button>
        </div>
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
          <a href="#/admin" className="admin-link">Админ</a>
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
        <div className="header-actions">
          <a href="#/admin" className="admin-link">Админ</a>
          <button type="button" className="cart-chip" onClick={onOpenCart}>
            Корзина {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

function TabBar({ activeTab, onChange }) {
  return (
    <div className="tabbar">
      <div className="container">
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
  const [qty, setQty] = useState(1)
  const [selectedFlavor, setSelectedFlavor] = useState(null)

  if (!product) return null

  const normalizedFlavors = Array.isArray(product.flavors)
    ? product.flavors
      .map((f) => (typeof f === 'string' ? f : (f.flavor_name || f.name)))
      .filter(Boolean)
    : []

  const canAdd = qty > 0 && (normalizedFlavors.length === 0 || selectedFlavor)

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{product.name}</div>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="section">
            <div className="section-title">Цена</div>
            <div className="price-display">
              {product.price} BYN
            </div>
          </div>

          {normalizedFlavors.length > 0 && (
            <div className="section">
              <div className="section-title">Вкус</div>
              <div className="flavor-chips">
                {normalizedFlavors.map((f) => (
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
            onClick={() => onClose('checkout')}
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

function MainApp() {
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('liquids')
  const [activeProduct, setActiveProduct] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartItems, setCartItems] = useState([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)
  const [products, setProducts] = useState([])

  // Загрузка товаров с API
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/products');
        if (response.ok) {
          const productsData = await response.json();
          const normalized = Array.isArray(productsData)
            ? productsData.map((p) => {
              const category = Number(p.category_id) === 1
                ? 'liquids'
                : (Number(p.category_id) === 2 ? 'consumables' : (p.category || null))

              const flavors = Array.isArray(p.flavors)
                ? p.flavors
                  .map((f) => (typeof f === 'string' ? f : (f.flavor_name || f.name)))
                  .filter(Boolean)
                : []

              return {
                ...p,
                category,
                flavors,
              }
            })
            : []

          setProducts(normalized);
        }
      } catch (error) {
        console.error('Error loading products:', error);
        // Если API не работает, добавим тестовые товары
        setProducts([
          { id: 1, name: 'Тестовый товар 1', price: 25, category: 'liquids' },
          { id: 2, name: 'Тестовый товар 2', price: 30, category: 'consumables' },
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadProducts()
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
        .map((x) => (x.key === item.key ? { ...x, qty: x.qty - 1 } : x))
        .filter((x) => x.qty > 0)
    )
  }

  const incItem = (item) => {
    setCartItems((prev) =>
      prev.map((x) => (x.key === item.key ? { ...x, qty: x.qty + 1 } : x))
    )
  }

  const removeItem = (item) => {
    setCartItems((prev) => prev.filter((x) => x.key !== item.key))
  }

  const startCheckout = () => {
    setCheckoutOpen(true)
  }

  const submitCheckout = async ({ telegram_username }) => {
    if (checkoutSubmitting) return
    setCheckoutSubmitting(true)
    try {
      const cleanUsername = String(telegram_username || '')
        .trim()
        .replace(/^@/, '')

      if (!cleanUsername) {
        throw new Error('Введи свой Telegram username')
      }

      const items = cartItems.map((it) => ({
        product_id: it.id,
        flavor_name: it.flavor || null,
        quantity: it.qty,
        price: it.price,
      }))

      const total_amount = items.reduce((sum, it) => sum + Number(it.price) * Number(it.quantity), 0)

      const payload = {
        total_amount,
        items,
        telegram_user: {
          telegram_id: `username:${cleanUsername}`,
          telegram_username: cleanUsername,
        },
      }

      const res = await ApiService.createOrder(payload)
      if (!res) throw new Error('Не удалось оформить заказ')

      setCartItems([])
      setCheckoutOpen(false)
      setCartOpen(false)
      alert('Заказ оформлен! Мы скоро свяжемся с тобой.')
    } catch (e) {
      alert(e?.message || 'Ошибка оформления заказа')
    } finally {
      setCheckoutSubmitting(false)
    }
  }

  return (
    <div className="app">
      <Preloader visible={loading} />
      <HeaderWithCart cartCount={cartCount} onOpenCart={() => setCartOpen(true)} />
      <main className="main">
        <div className="container">
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
            onClose={(next) => {
              if (next === 'checkout') return startCheckout()
              setCartOpen(false)
            }}
            onDec={decItem}
            onInc={incItem}
            onRemove={removeItem}
            onClear={() => setCartItems([])}
          />
          <CheckoutModal
            open={checkoutOpen}
            onClose={() => setCheckoutOpen(false)}
            onSubmit={submitCheckout}
            submitting={checkoutSubmitting}
          />
        </div>
      </main>
    </div>
  )
}

function App() {
  const [isAdmin, setIsAdmin] = useState(false)

  // Проверка админ аутентификации
  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken')
    if (adminToken) {
      setIsAdmin(true)
    }
  }, [])

  const handleAdminLogin = (adminData) => {
    setIsAdmin(true)
  }

  const handleAdminLogout = () => {
    setIsAdmin(false)
    localStorage.removeItem('adminToken')
  }

  return (
    <Router>
      <Routes>
        <Route path="/admin" element={!isAdmin ? <AdminLogin onLogin={handleAdminLogin} /> : <AdminPanel onLogout={handleAdminLogout} />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </Router>
  )
}

export default App
