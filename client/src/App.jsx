import { useEffect, useMemo, useState } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import logo from './assets/paradise-shop-logo.svg'
import ApiService from './services/api'
import AdminLogin from './components/AdminLogin'
import AdminPanel from './components/AdminPanel'

// Force redeploy
console.log('Crocky Vape v1.0');

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
          <img className="preloader-logo" src={logo} alt="CROCKYVAPE" />
          <div className="preloader-smoke" />
        </div>
        <div className="preloader-title">CROCKYVAPE</div>
        <div className="preloader-subtitle">Загружаем каталог…</div>
      </div>
    </div>
  )
}

function CheckoutModal({ open, onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({
    telegram_username: '',
    metro_station: '',
  })

  const metroStations = [
    'Аэродромная',
    'Институт Культуры',
    'Каменная Горка',
    'Кунцевщина',
    'Молодежная',
    'Немига',
    'Октябрьская',
    'Парк Челюскинцев',
    'Первомайская',
    'Площадь Ленина',
    'Площадь Победы',
    'Пушкинская',
    'Спортивная',
    'Театральная',
    'Фрунзенская',
    'Юбилейная',
    'Автозаводская',
    'Восток',
    'Грушевка',
    'Ковальская Слобода',
    'Малиновка',
    'Могилевская',
    'Партизанская',
    'Переспа',
    'Пролетарская',
    'Славинский',
    'Тракторный Завод',
    'Уручье',
    'Борисовский Тракт',
    'Вокзальная',
    'Дружная',
    'Михалово',
    'Московская',
    'Осмоловка',
    'Партизанская',
    'Петровка',
    'Площадь Франтишка Богушевича',
    'Площадь Якуба Коласа',
    'Серебрянка',
    'Серова',
    'Уручье',
    'Филиал',
    'Цнянка',
  ]

  useEffect(() => {
    if (!open) return
    setForm({ telegram_username: '', metro_station: '' })
  }, [open])

  if (!open) return null

  return (
    <div className="modal-overlay checkout-modal-overlay active" onClick={onClose}>
      <div className="modal checkout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Оформление заказа [v1.0.8]</div>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="section" style={{ marginBottom: '20px' }}>
            <div className="section-title" style={{ color: 'var(--text)', marginBottom: '8px', display: 'block' }}>Твой Telegram Username</div>
            <input
              type="text"
              className="input"
              placeholder="Например: ivan_vape"
              style={{ display: 'block', width: '100%', padding: '12px' }}
              value={form.telegram_username}
              onChange={(e) => setForm((p) => ({ ...p, telegram_username: e.target.value }))}
            />
          </div>

          <div className="section" style={{ marginBottom: '20px' }}>
            <div className="section-title" style={{ color: 'var(--text)', marginBottom: '8px', display: 'block' }}>Станция метро в Минске</div>
            <select
              className="input"
              style={{ display: 'block', width: '100%', padding: '12px', appearance: 'auto' }}
              value={form.metro_station}
              onChange={(e) => setForm((p) => ({ ...p, metro_station: e.target.value }))}
            >
              <option value="">Выбери станцию метро</option>
              {metroStations.map((station) => (
                <option key={station} value={station}>
                  {station}
                </option>
              ))}
            </select>
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
          <img className="brand-logo" src={logo} alt="CROCKYVAPE" />
          <div className="brand-text">
            <div className="brand-title">CROCKYVAPE</div>
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
          <img className="brand-logo" src={logo} alt="CROCKYVAPE" />
          <div className="brand-text">
            <div className="brand-title">CROCKYVAPE</div>
            <div className="brand-subtitle">Mini App</div>
          </div>
        </div>
        <div className="header-actions">
          <a href="#/admin" className="admin-link">Админ</a>
          <button type="button" className="cart-chip" onClick={onOpenCart}>
            Корзина {cartCount > 0 && <span className="cart-chip-badge">{cartCount}</span>}
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
          {filtered.map((it) => {
            const normalizedFlavors = Array.isArray(it.flavors)
              ? it.flavors
                  .map((f) => {
                    if (typeof f === 'string') {
                      return { name: f, stock: 0 };
                    }
                    return {
                      name: f?.flavor_name || f?.name || '',
                      stock: Number(f?.stock ?? 0),
                    };
                  })
                  .filter((f) => f.name && f.stock > 0)
              : [];

            return (
              <button
                key={it.id}
                type="button"
                className="card card-clickable"
                onClick={() => onOpenProduct(it)}
              >
                <div className="card-thumb">
                  {it.image_url && <img src={it.image_url} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />}
                </div>
                <div className="card-name">{it.name}</div>
                {normalizedFlavors.length > 0 && (
                  <div className="card-flavors">
                    {normalizedFlavors.slice(0, 3).map((flavor, idx) => (
                      <div key={idx} className="card-flavor">
                        {flavor.name} {flavor.stock}шт
                      </div>
                    ))}
                    {normalizedFlavors.length > 3 && (
                      <div className="card-flavor-more">
                        +{normalizedFlavors.length - 3} еще
                      </div>
                    )}
                  </div>
                )}
                {normalizedFlavors.length === 0 && Number(it.stock) > 0 && (
                  <div className="card-stock">Остаток: {Number(it.stock)} шт</div>
                )}
                <div className="card-row">
                  <div className="card-price">{it.price} BYN</div>
                  <div className="card-open">Открыть</div>
                </div>
              </button>
            );
          })}
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
      .map((f) => {
        if (typeof f === 'string') {
          return { name: f, stock: 0 }
        }
        return {
          name: f?.flavor_name || f?.name || '',
          stock: Number(f?.stock ?? 0),
        }
      })
      .filter((f) => f?.name)
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
                    key={f.name}
                    type="button"
                    className={`chip ${selectedFlavor === f.name ? 'active' : ''}`}
                    disabled={Number(f.stock) <= 0}
                    onClick={() => setSelectedFlavor(f.name)}
                  >
                    {f.name} ({Number(f.stock) || 0})
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
  const totalQty = useMemo(() => items.reduce((sum, it) => sum + it.qty, 0), [items])

  return (
    <div className={`cart-drawer-overlay ${open ? 'active' : ''}`} aria-hidden={!open}>
      <div className="cart-drawer" role="dialog" aria-modal="true">
        <div className="cart-drawer-header">
          <div className="cart-drawer-title">
            <span>🛒 Корзина</span>
            {totalQty > 0 && (
              <span className="cart-count">{totalQty} {totalQty === 1 ? 'товар' : totalQty <= 4 ? 'товара' : 'товаров'}</span>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className="cart-items">
          {items.length === 0 ? (
            <div className="cart-empty">
              <div className="cart-empty-icon">🛍️</div>
              <div className="cart-empty-title">Корзина пуста</div>
              <div className="cart-empty-text">Добавь товары для оформления заказа</div>
            </div>
          ) : (
            <div className="cart-items-list">
              {items.map((it) => (
                <div key={it.key} className="cart-item">
                  <div className="cart-item-image" />
                  <div className="cart-item-info">
                    <div className="cart-item-header">
                      <div className="cart-item-name">{it.name}</div>
                      <button 
                        type="button" 
                        className="cart-item-delete-btn" 
                        onClick={() => onRemove(it)}
                        aria-label="Удалить товар"
                      >
                        🗑️
                      </button>
                    </div>
                    {it.flavor && <div className="cart-item-flavor">Вкус: {it.flavor}</div>}
                    <div className="cart-item-footer">
                      <div className="cart-item-price">{it.price} BYN</div>
                      <div className="cart-item-qty">
                        <button 
                          type="button" 
                          className="qty-btn qty-btn-dec" 
                          onClick={() => onDec(it)}
                          disabled={it.qty <= 1}
                        >
                          −
                        </button>
                        <span className="qty-value">{it.qty}</span>
                        <button 
                          type="button" 
                          className="qty-btn qty-btn-inc" 
                          onClick={() => onInc(it)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="cart-summary">
              <div className="cart-total">
                <span>Итого:</span>
                <span className="cart-total-value">{total.toFixed(2)} BYN</span>
              </div>
              <button 
                type="button" 
                className="cart-clear-btn" 
                onClick={onClear}
              >
                Очистить
              </button>
            </div>
            <button
              type="button"
              className="checkout-btn"
              onClick={() => onClose('checkout')}
            >
              Оформить заказ →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ReviewsPlaceholder() {
  const [reviewForm, setReviewForm] = useState({
    username: '',
    text: '',
    rating: 5
  })
  const [submitting, setSubmitting] = useState(false)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  // Загрузка отзывов
  useEffect(() => {
    const loadReviews = async () => {
      try {
        const data = await ApiService.getReviews()
        setReviews(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Error loading reviews:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadReviews()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    
    if (!reviewForm.username.trim() || !reviewForm.text.trim()) {
      alert('Заполни все поля!')
      return
    }

    setSubmitting(true)
    try {
      const created = await ApiService.createReview({
        telegram_username: reviewForm.username,
        review_text: reviewForm.text,
        rating: reviewForm.rating,
      })

      if (created) {
        alert('Спасибо за отзыв! 🎉 Он будет опубликован после модерации.')
        setReviewForm({ username: '', text: '', rating: 5 })
        
        // Перезагружаем отзывы
        const data = await ApiService.getReviews()
        setReviews(Array.isArray(data) ? data : [])
      } else {
        throw new Error('Failed to submit review')
      }
    } catch (error) {
      console.error('Error submitting review:', error)
      alert('Ошибка отправки отзыва')
    } finally {
      setSubmitting(false)
    }
  }

  const renderStars = (rating) => {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating)
  }

  return (
    <div className="screen">
      <div className="container">
        <div className="screen-title">Отзывы</div>
        <div className="panel">
          <div className="panel-title">Оставь отзыв</div>
          <form onSubmit={handleSubmit}>
            <input 
              className="input" 
              placeholder="Твой ник в Telegram" 
              value={reviewForm.username}
              onChange={(e) => setReviewForm(prev => ({ ...prev, username: e.target.value }))}
              disabled={submitting}
            />
            <div style={{ margin: '12px 0' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Оценка:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${star <= reviewForm.rating ? 'active' : ''}`}
                    onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                    disabled={submitting}
                    style={{ 
                      fontSize: '24px', 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer',
                      opacity: star <= reviewForm.rating ? 1 : 0.3
                    }}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>
            <textarea 
              className="textarea" 
              placeholder="Напиши отзыв…" 
              rows={4}
              value={reviewForm.text}
              onChange={(e) => setReviewForm(prev => ({ ...prev, text: e.target.value }))}
              disabled={submitting}
            />
            <button 
              type="submit" 
              className="primary-btn"
              disabled={submitting}
            >
              {submitting ? 'Отправляем...' : 'Отправить'}
            </button>
          </form>
        </div>
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title">Последние отзывы</div>
          {loading ? (
            <div className="review-empty">
              <div>Загружаем отзывы...</div>
            </div>
          ) : reviews.length === 0 ? (
            <div className="review-empty">
              <div>Пока нет отзывов. Будь первым!</div>
            </div>
          ) : (
            <div className="reviews-list">
              {reviews.map((review) => (
                <div key={review.id} className="review-item" style={{ 
                  padding: '12px', 
                  borderBottom: '1px solid #eee',
                  marginBottom: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontWeight: '600' }}>{review.telegram_username || 'Аноним'}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {new Date(review.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <div style={{ marginBottom: '8px' }}>{renderStars(review.rating)}</div>
                  <div style={{ lineHeight: '1.4' }}>{review.review_text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MainApp() {
  console.log('MainApp component mounted!');
  
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('liquids')
  const [activeProduct, setActiveProduct] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartItems, setCartItems] = useState([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)
  const [products, setProducts] = useState([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // Отслеживание состояния сети
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => {
      setIsOnline(false)
      alert('Потеряно подключение к интернету. Некоторые функции могут не работать.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Загрузка товаров с API
  useEffect(() => {
    console.log('useEffect for products loading triggered!');
    const loadProducts = async (retryCount = 0) => {
      try {
        console.log('Starting to load products, attempt:', retryCount + 1);
        setLoading(true)
        const response = await fetch('/api/products');
        console.log('API response status:', response.status);
        console.log('API response ok:', response.ok);
        
        if (response.ok) {
          const productsData = await response.json();
          console.log('Raw products data:', productsData);
          const normalized = Array.isArray(productsData)
            ? productsData.map((p) => {
              const category = Number(p.category_id) === 1
                ? 'liquids'
                : (Number(p.category_id) === 2 ? 'consumables' : (p.category || null))

              const flavors = Array.isArray(p.flavors)
                ? p.flavors
                  .map((f) => {
                    if (typeof f === 'string') {
                      return { flavor_name: f, stock: 0 }
                    }
                    return {
                      flavor_name: f?.flavor_name || f?.name || '',
                      stock: Number(f?.stock ?? 0),
                    }
                  })
                  .filter((f) => f?.flavor_name)
                : []

              return {
                ...p,
                category,
                flavors,
              }
            })
            : []

          setProducts(normalized.filter(p => Number(p.stock) > 0));
          console.log('Products loaded:', normalized.length);
          console.log('Products after stock filter:', normalized.filter(p => Number(p.stock) > 0).length);
          console.log('Sample product:', normalized[0]);
        } else {
          console.error('API response not ok:', response.status, response.statusText);
          throw new Error('Failed to load products');
        }
      } catch (error) {
        console.error('Error loading products:', error);
        if (retryCount < 2) {
          // Retry after 2 seconds
          setTimeout(() => loadProducts(retryCount + 1), 2000);
        } else {
          // Show error after 3 failed attempts
          alert('Не удалось загрузить товары. Пожалуйста, обновите страницу.');
          setProducts([]);
        }
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [])

  const cartCount = useMemo(() => cartItems.reduce((sum, it) => sum + it.qty, 0), [cartItems])

  const addToCart = (product, flavor, qty) => {
    // Проверка остатков
    if (flavor) {
      const normalizedSelected = String(flavor || '').trim()
      const flavorData = product.flavors?.find(f => {
        const name = typeof f === 'string' ? f : (f.flavor_name || f.name)
        return String(name || '').trim() === normalizedSelected
      });

      const stock = Number(
        typeof flavorData === 'object'
          ? (flavorData?.stock ?? product.stock)
          : product.stock
      )
      if (stock < qty) {
        alert(`Остаток по вкусу "${flavor}": ${stock} шт.`);
        return;
      }
    } else {
      if (product.stock < qty) {
        alert(`Остаток товара: ${product.stock} шт.`);
        return;
      }
    }

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
      
      // Проверка остатков при увеличении количества
      const newQty = existing.qty + qty;
      if (flavor) {
        const normalizedSelected = String(flavor || '').trim()
        const flavorData = product.flavors?.find(f => {
          const name = typeof f === 'string' ? f : (f.flavor_name || f.name)
          return String(name || '').trim() === normalizedSelected
        });
        const stock = Number(
          typeof flavorData === 'object'
            ? (flavorData?.stock ?? product.stock)
            : product.stock
        )
        if (stock < newQty) {
          alert(`Остаток по вкусу "${flavor}": ${stock} шт.`);
          return prev;
        }
      } else {
        if (product.stock < newQty) {
          alert(`Остаток товара: ${product.stock} шт.`);
          return prev;
        }
      }
      
      return prev.map((x) => (x.key === key ? { ...x, qty: newQty } : x))
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

  const submitCheckout = async ({ telegram_username, metro_station }) => {
    if (checkoutSubmitting) return
    
    if (cartItems.length === 0) {
      alert('Корзина пуста!')
      return
    }

    // Проверка интернет соединения
    if (!navigator.onLine) {
      alert('Нет подключения к интернету. Проверь соединение и попробуй снова.')
      return
    }
    
    setCheckoutSubmitting(true)
    try {
      const cleanUsername = String(telegram_username || '')
        .trim()
        .replace(/^@/, '')

      if (!cleanUsername) {
        throw new Error('Введи свой Telegram username')
      }

      // Валидация формата username
      if (cleanUsername.length < 3 || cleanUsername.length > 32) {
        throw new Error('Username должен быть от 3 до 32 символов')
      }

      if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
        throw new Error('Username может содержать только буквы, цифры и _')
      }

      if (!metro_station) {
        throw new Error('Выбери станцию метро')
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
          metro_station,
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
      {!isOnline && (
        <div className="offline-indicator">
          📵 Нет подключения к интернету
        </div>
      )}
      <Preloader visible={loading} />
      <HeaderWithCart cartCount={cartCount} onOpenCart={() => setCartOpen(true)} />
      <main className="main">
        <div className="container">
          {activeTab === 'liquids' && (
            <ProductGrid
              title="Жидкости"
              products={products.filter(p => p.category === 'liquids' && Number(p.stock) > 0)}
              onOpenProduct={(p) => {
                console.log('Opening product:', p);
                setActiveProduct(p);
              }}
              query={searchQuery}
            />
          )}
          {activeTab === 'consumables' && (
            <ProductGrid
              title="Расходники"
              products={products.filter(p => p.category === 'consumables' && Number(p.stock) > 0)}
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
